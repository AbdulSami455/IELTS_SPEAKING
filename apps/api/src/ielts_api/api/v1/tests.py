"""Test and report routes."""

from __future__ import annotations

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.api.v1.schemas import (
    ConsentRequest,
    DeviceCheckRequest,
    GoalRequest,
    PracticeActionPatch,
    RealtimeClientEventRequest,
    TransitionRequest,
    UploadCompleteRequest,
    UserResponse,
    camelize,
)
from ielts_api.auth.identity import get_identity_verifier
from ielts_api.auth.identity import AuthenticatedUser
from ielts_api.deps import get_session, object_store, require_user, settings
from ielts_api.services.realtime import RealtimeSessionService
from ielts_api.services.tests import TestService
from ielts_config import EnvironmentConfig
from ielts_db.repositories import UserRepository
from ielts_db.storage import ObjectStore

router = APIRouter()


def service(
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
    store: ObjectStore = Depends(object_store),
) -> TestService:
    return TestService(session, config, store)


def realtime_service(
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
    store: ObjectStore = Depends(object_store),
) -> RealtimeSessionService:
    return RealtimeSessionService(session, config, store)


def envelope(data, request_id: str = "local"):
    return {"data": camelize(jsonable_encoder(data)), "requestId": request_id}


@router.get("/me")
async def me(
    user: AuthenticatedUser = Depends(require_user),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    return envelope(
        UserResponse(
            id=str(user.user_id),
            email=user.email,
            display_name=user.display_name,
            consent_version=user.consent_version,
            consent_required=user.consent_version != config.consent_version,
        )
    )


@router.post("/me/consent")
async def consent(
    payload: ConsentRequest,
    user: AuthenticatedUser = Depends(require_user),
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    if not payload.accepted:
        from ielts_api.errors import validation

        raise validation("Consent is required to record audio")
    repo = UserRepository(session)
    saved = await repo.record_consent(user.user_id, payload.version or config.consent_version)
    await session.commit()
    return envelope(
        UserResponse(
            id=str(saved.id),
            email=saved.email,
            display_name=saved.display_name,
            consent_version=saved.consent_version,
            consent_required=False,
        )
    )


@router.delete("/me")
async def delete_me(
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    await svc.delete_account(user.user_id)
    return envelope({"deleted": True})


@router.get("/question-sets")
async def question_sets(
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.list_question_sets())


@router.post("/tests")
async def create_test(
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
    slug: str | None = Query(default=None),
) -> dict:
    return envelope(await svc.create_test(user.user_id, slug))


@router.get("/tests")
async def list_tests(
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.list_tests(user.user_id))


@router.get("/tests/{test_id}")
async def get_test(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.get_test(user.user_id, test_id))


@router.post("/tests/{test_id}/device-check")
async def device_check(
    test_id: str,
    payload: DeviceCheckRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.device_check(user.user_id, test_id, payload.model_dump()))


@router.post("/tests/{test_id}/realtime/session")
async def create_realtime_session(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: RealtimeSessionService = Depends(realtime_service),
) -> dict:
    return envelope(await svc.create_session(user.user_id, test_id))


@router.post("/tests/{test_id}/realtime/events")
async def ingest_realtime_event(
    test_id: str,
    payload: RealtimeClientEventRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: RealtimeSessionService = Depends(realtime_service),
) -> dict:
    return envelope(await svc.ingest_event(user.user_id, test_id, payload.model_dump()))


@router.post("/tests/{test_id}/realtime/turns/{turn_id}/audio")
async def upload_realtime_turn_audio(
    test_id: str,
    turn_id: str,
    audio: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_user),
    svc: RealtimeSessionService = Depends(realtime_service),
) -> dict:
    return envelope(
        await svc.upload_turn_audio(
            user.user_id,
            test_id,
            turn_id,
            await audio.read(),
            audio.content_type or "audio/webm",
        )
    )


@router.websocket("/tests/{test_id}/realtime/live")
async def realtime_live_socket(
    websocket: WebSocket,
    test_id: str,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
    store: ObjectStore = Depends(object_store),
) -> None:
    token = websocket.query_params.get("token", "")
    identity = await get_identity_verifier(config).verify(token)
    if identity is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    repo = UserRepository(session)
    user = await repo.create_or_update(
        auth_subject=identity.auth_subject,
        email=identity.email,
        display_name=identity.display_name,
    )
    await session.commit()
    await websocket.accept()
    svc = RealtimeSessionService(session, config, store)
    await websocket.send_json(envelope(await svc.create_session(user.id, test_id)))
    try:
        while True:
            payload = await websocket.receive_json()
            data = RealtimeClientEventRequest.model_validate(payload)
            await websocket.send_json(envelope(await svc.ingest_event(user.id, test_id, data.model_dump())))
    except WebSocketDisconnect:
        return


@router.post("/tests/{test_id}/transitions")
async def transitions(
    test_id: str,
    payload: TransitionRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.transition(user.user_id, test_id, payload.event, payload.expected_revision))


@router.post("/tests/{test_id}/conversation/start")
async def start_conversation(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.start_conversation(user.user_id, test_id))


@router.post("/tests/{test_id}/answers/{answer_id}/upload")
async def upload(
    test_id: str,
    answer_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.authorize_upload(user.user_id, test_id, answer_id))


@router.post("/tests/{test_id}/turns/{turn_id}/response/upload")
async def upload_turn_response(
    test_id: str,
    turn_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.authorize_turn_upload(user.user_id, test_id, turn_id))


@router.post("/tests/{test_id}/answers/{answer_id}/upload-complete")
async def upload_complete(
    test_id: str,
    answer_id: str,
    payload: UploadCompleteRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.complete_upload(user.user_id, test_id, answer_id, payload.model_dump()))


@router.post("/tests/{test_id}/turns/{turn_id}/response/complete")
async def upload_turn_response_complete(
    test_id: str,
    turn_id: str,
    payload: UploadCompleteRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.complete_turn_upload(user.user_id, test_id, turn_id, payload.model_dump()))


@router.post("/tests/{test_id}/submit")
async def submit(
    test_id: str,
    background: BackgroundTasks,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    from ielts_api.jobs import enqueue_evaluate

    data = await svc.submit(user.user_id, test_id)
    background.add_task(enqueue_evaluate, test_id)
    return envelope(data)


@router.post("/tests/{test_id}/finish")
async def finish(
    test_id: str,
    background: BackgroundTasks,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    from ielts_api.jobs import enqueue_evaluate

    data = await svc.submit(user.user_id, test_id)
    background.add_task(enqueue_evaluate, test_id)
    return envelope(data)


@router.get("/tests/{test_id}/status")
async def status(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.status(user.user_id, test_id))


@router.get("/tests/{test_id}/events")
async def events(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> StreamingResponse:
    import asyncio
    import json

    async def generate():
        for _ in range(600):
            payload = await svc.status(user.user_id, test_id)
            yield f"data: {json.dumps(payload)}\n\n"
            if payload["stage"] in {"completed", "failed"}:
                break
            await asyncio.sleep(1)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/tests/{test_id}/questions/{question_id}/examiner-audio")
async def examiner_audio(
    test_id: str,
    question_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.examiner_audio(user.user_id, test_id, question_id))


@router.get("/tests/{test_id}/answers/{answer_id}/playback")
async def answer_playback(
    test_id: str,
    answer_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.answer_playback(user.user_id, test_id, answer_id))


@router.delete("/tests/{test_id}")
async def delete_test(
    test_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    await svc.delete_test(user.user_id, test_id)
    return envelope({"deleted": True})


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.get_report(user.user_id, report_id))


@router.get("/reports/{report_id}/export")
async def export_report(
    report_id: str,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> HTMLResponse:
    return HTMLResponse(await svc.export_report(user.user_id, report_id))


@router.get("/progress/overview")
async def progress(
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.progress_overview(user.user_id))


@router.put("/progress/goals/current")
async def upsert_goal(
    payload: GoalRequest,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.upsert_goal(user.user_id, payload.model_dump()))


@router.patch("/practice-actions/{action_id}")
async def patch_action(
    action_id: str,
    payload: PracticeActionPatch,
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.patch_action(user.user_id, action_id, payload.model_dump()))
