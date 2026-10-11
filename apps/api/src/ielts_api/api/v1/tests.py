"""Test and report routes."""

from __future__ import annotations

import json

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import ValidationError
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
from ielts_api.auth.identity import AuthenticatedUser, get_identity_verifier
from ielts_api.deps import get_session, object_store, require_consent, require_user, settings
from ielts_api.errors import AppError, validation
from ielts_api.rate_limit import EVENTS_LIMIT, SOCKET_LIMIT, allow, enforce
from ielts_api.services.realtime import RealtimeSessionService
from ielts_api.services.tests import TestService
from ielts_config import EnvironmentConfig
from ielts_db.repositories import ConsentRepository, UserRepository
from ielts_db.storage import ObjectStore

router = APIRouter()

MAX_SOCKET_MESSAGE_BYTES = 16 * 1024
MAX_BAD_SOCKET_FRAMES = 3


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


def _user_response(user: AuthenticatedUser, config: EnvironmentConfig) -> UserResponse:
    return UserResponse(
        id=str(user.user_id),
        email=user.email,
        display_name=user.display_name,
        consent_version=user.consent_version,
        consent_required=user.consent_version != config.consent_version,
        current_consent_version=config.consent_version,
    )


@router.get("/me")
async def me(
    user: AuthenticatedUser = Depends(require_user),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    return envelope(_user_response(user, config))


@router.post("/me/consent")
async def consent(
    payload: ConsentRequest,
    request: Request,
    user: AuthenticatedUser = Depends(require_user),
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    if not payload.accepted:
        raise validation("Consent is required to record audio")
    repo = UserRepository(session)
    account = await repo.get_by_id(user.user_id)
    if account is None:
        raise AppError("AUTH_REQUIRED", "Account not found", 401)
    # The server decides which version is being accepted.
    await ConsentRepository(session).record(
        account,
        config.consent_version,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return envelope(
        UserResponse(
            id=str(account.id),
            email=account.email,
            display_name=account.display_name,
            consent_version=account.consent_version,
            consent_required=False,
            current_consent_version=config.consent_version,
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
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
    slug: str | None = Query(default=None, max_length=80),
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
    practice_mode: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_user),
    svc: TestService = Depends(service),
) -> dict:
    result = await svc.get_test(user.user_id, test_id)
    if practice_mode:
        result["practice_mode"] = True
        result["practice_mode_note"] = "Practice mode: no credit consumption or real-time LLM scoring"
    return envelope(result)


@router.post("/tests/{test_id}/device-check")
async def device_check(
    test_id: str,
    payload: DeviceCheckRequest,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.device_check(user.user_id, test_id, payload.model_dump()))


@router.post("/tests/{test_id}/realtime/session")
async def create_realtime_session(
    test_id: str,
    user: AuthenticatedUser = Depends(require_consent),
    svc: RealtimeSessionService = Depends(realtime_service),
) -> dict:
    return envelope(await svc.create_session(user.user_id, test_id))


@router.post("/tests/{test_id}/realtime/events")
async def ingest_realtime_event(
    test_id: str,
    payload: RealtimeClientEventRequest,
    user: AuthenticatedUser = Depends(require_consent),
    svc: RealtimeSessionService = Depends(realtime_service),
) -> dict:
    await enforce(str(user.user_id), EVENTS_LIMIT)
    return envelope(await svc.ingest_event(user.user_id, test_id, payload.model_dump()))


@router.post("/tests/{test_id}/realtime/turns/{turn_id}/audio")
async def upload_realtime_turn_audio(
    test_id: str,
    turn_id: str,
    audio: UploadFile = File(...),
    user: AuthenticatedUser = Depends(require_consent),
    svc: RealtimeSessionService = Depends(realtime_service),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    # The request guard already caps the declared size; this bounds the actual bytes.
    limit = config.upload_max_bytes_per_answer
    data = await audio.read(limit + 1)
    if len(data) > limit:
        raise AppError("PAYLOAD_TOO_LARGE", f"Recordings are limited to {limit} bytes.", 413)
    return envelope(
        await svc.upload_turn_audio(
            user.user_id,
            test_id,
            turn_id,
            data,
            audio.content_type or "audio/webm",
        )
    )


async def _socket_error(websocket: WebSocket, code: str, message: str) -> None:
    await websocket.send_json({"type": "error", "code": code, "message": message})


@router.websocket("/tests/{test_id}/realtime/live")
async def realtime_live_socket(
    websocket: WebSocket,
    test_id: str,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
    store: ObjectStore = Depends(object_store),
) -> None:
    origin = (websocket.headers.get("origin") or "").rstrip("/")
    if origin and origin not in {item.rstrip("/") for item in config.allowed_origins}:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    token = websocket.cookies.get("auth-token", "")
    identity = await get_identity_verifier(config).verify(token, expected_token_type="access")
    if identity is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user = await UserRepository(session).get_by_auth_subject(identity.auth_subject)
    if user is None or user.consent_version != config.consent_version:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    svc = RealtimeSessionService(session, config, store)
    try:
        await websocket.send_json(envelope(await svc.create_session(user.id, test_id)))
    except AppError as exc:
        await _socket_error(websocket, exc.code, exc.message)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    bad_frames = 0
    socket_key = f"{user.id}:{test_id}"
    try:
        while True:
            try:
                raw = await websocket.receive_text()
            except (KeyError, RuntimeError):
                # Binary or malformed frames are not part of the protocol.
                await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                return
            if len(raw) > MAX_SOCKET_MESSAGE_BYTES:
                bad_frames += 1
                await _socket_error(websocket, "PAYLOAD_TOO_LARGE", "Message too large")
                if bad_frames >= MAX_BAD_SOCKET_FRAMES:
                    await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG)
                    return
                continue
            try:
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError("expected an object")
            except ValueError:
                bad_frames += 1
                await _socket_error(websocket, "INVALID_MESSAGE", "Messages must be JSON objects")
                if bad_frames >= MAX_BAD_SOCKET_FRAMES:
                    await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                    return
                continue
            if payload.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if not await allow(socket_key, SOCKET_LIMIT):
                await _socket_error(websocket, "RATE_LIMITED", "Too many messages; slow down")
                continue
            try:
                data = RealtimeClientEventRequest.model_validate(payload)
                result = await svc.ingest_event(user.id, test_id, data.model_dump())
            except ValidationError:
                bad_frames += 1
                await _socket_error(websocket, "VALIDATION_FAILED", "Unsupported event payload")
                continue
            except AppError as exc:
                await _socket_error(websocket, exc.code, exc.message)
                continue
            await websocket.send_json(envelope(result))
    except WebSocketDisconnect:
        return


@router.post("/tests/{test_id}/turns/{turn_id}/retake")
async def retake_turn(
    test_id: str,
    turn_id: str,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.retake_turn(user.user_id, test_id, turn_id))


@router.post("/tests/{test_id}/transitions")
async def transitions(
    test_id: str,
    payload: TransitionRequest,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.transition(user.user_id, test_id, payload.event, payload.expected_revision))


@router.post("/tests/{test_id}/conversation/start")
async def start_conversation(
    test_id: str,
    practice_mode: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.start_conversation(user.user_id, test_id, practice_mode))


@router.post("/tests/{test_id}/answers/{answer_id}/upload")
async def upload(
    test_id: str,
    answer_id: str,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.authorize_upload(user.user_id, test_id, answer_id))


@router.post("/tests/{test_id}/turns/{turn_id}/response/upload")
async def upload_turn_response(
    test_id: str,
    turn_id: str,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.authorize_turn_upload(user.user_id, test_id, turn_id))


@router.post("/tests/{test_id}/answers/{answer_id}/upload-complete")
async def upload_complete(
    test_id: str,
    answer_id: str,
    payload: UploadCompleteRequest,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.complete_upload(user.user_id, test_id, answer_id, payload.model_dump()))


@router.post("/tests/{test_id}/turns/{turn_id}/response/complete")
async def upload_turn_response_complete(
    test_id: str,
    turn_id: str,
    payload: UploadCompleteRequest,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    return envelope(await svc.complete_turn_upload(user.user_id, test_id, turn_id, payload.model_dump()))


@router.post("/tests/{test_id}/submit")
async def submit(
    test_id: str,
    background: BackgroundTasks,
    practice_mode: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    from ielts_api.jobs import enqueue_evaluate

    data = await svc.submit(user.user_id, test_id, practice_mode)
    if not practice_mode:
        background.add_task(enqueue_evaluate, test_id)
    return envelope(data)


@router.post("/tests/{test_id}/finish")
async def finish(
    test_id: str,
    background: BackgroundTasks,
    practice_mode: bool = Query(default=False),
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    from ielts_api.jobs import enqueue_evaluate

    data = await svc.submit(user.user_id, test_id, practice_mode)
    if not practice_mode:
        background.add_task(enqueue_evaluate, test_id)
    return envelope(data)


@router.get("/tests/{test_id}/status")
async def status_route(
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

    async def generate():
        # Bounded to five minutes; the client reconnects if scoring takes longer.
        for _ in range(150):
            payload = await svc.status(user.user_id, test_id)
            yield f"data: {json.dumps(payload)}\n\n"
            if payload["stage"] in {"completed", "failed"}:
                break
            await asyncio.sleep(2)

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


@router.post("/reports/{report_id}/reassess")
async def reassess_report(
    report_id: str,
    background: BackgroundTasks,
    user: AuthenticatedUser = Depends(require_consent),
    svc: TestService = Depends(service),
) -> dict:
    from ielts_api.jobs import enqueue_evaluate

    test_id = await svc.reassess_report(user.user_id, report_id)
    background.add_task(enqueue_evaluate, test_id)
    return envelope({"test_id": test_id})
