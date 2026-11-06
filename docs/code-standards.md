# Code standards

This is how this repo is actually written. Match the file next to yours
before inventing a new pattern. The mechanical checks are [CONTRIBUTING.md](../CONTRIBUTING.md)
and `make check`.

## Layout

| Path | Owns |
| --- | --- |
| `packages/domain` | Frozen dataclasses, enums, state machines. No FastAPI, SQLAlchemy, Celery, or HTTP. |
| `packages/config` | `EnvironmentConfig` — every runtime setting is an env var. |
| `packages/db` | SQLAlchemy models, repositories, object storage. |
| `packages/inference` | Examiner, STT/TTS client, scoring, retention, probes. |
| `packages/audio` | ffmpeg / acoustics. |
| `packages/observability` | JSON logs, Prometheus, PII redaction. |
| `apps/api` | FastAPI routers, auth, rate limits, thin services that call the packages. |
| `apps/worker` | Celery app. Tasks call `TestService`; they do not reimplement scoring. |
| `apps/web` | React 19 + Vite. Pages in `src/features/`, shared UI in `src/components/studio/`. |
| `migrations/` | Alembic only. CI applies every revision to an empty database. |
| `evals/` | Golden scoring set, examiner cases, STT/TTS probes. |

Python packages use the src layout (`src/<name>/`). Tests sit next to the
package (`apps/api/tests`, `packages/domain/tests`), not inside `src/`.

## Python

- Python **3.13**. Line length **120**. Formatter is Ruff (not Black).
- `from __future__ import annotations` on production modules.
- Prefer `|` unions, `Mapped[...]`, and concrete types. Do not add `Any` to
  silence a design problem.
- Routers stay thin: parse a Pydantic model, call a service, map `AppError`
  to HTTP, return JSON. Business rules live in services or `packages/`.
- Request/response models inherit `ApiModel` in `apps/api/src/ielts_api/api/v1/schemas.py`.
  JSON is camelCase (`populate_by_name`). IELTS criterion map keys stay
  snake_case so the web client can look them up.
- Do not talk to SQL from a router. Do not call the LLM from a router.
- Env vars are read once in `EnvironmentConfig.from_env()`. Do not call
  `os.getenv` in services.
- Broad `except Exception` is allowed at an external boundary (object store,
  model HTTP) if you log and continue. Do not swallow errors with `pass`.
- New behaviour gets a pytest. Live model calls use `@pytest.mark.eval_live`
  and stay out of default `pytest -q`.

```python
# Thin route
@router.post("/tests")
async def create_test(payload: CreateTestRequest, service: TestService = Depends(get_service)):
    session = await service.create(payload)
    return envelope(session)

# Settings come from config, not os.environ
band = assemble(score, config.evaluator_version)
```

Ruff in CI is `E4`, `E7`, `E9`, `F` only. Do not enable extra rule families in
the same PR as a feature.

## TypeScript / React

- Node **22**. `strict` TypeScript. Path alias `@/` → `src/`.
- Named exports for pages and components. Default export only for `App.tsx`.
- Product chrome wraps shadcn: edit `src/components/studio/`. Leave
  `src/components/ui/` alone (generated; ESLint and Prettier ignore it).
- API types in `src/lib/api/types.ts` follow the camelCase JSON the API
  already emits. Do not recase in the component.
- Tests sit next to the file (`ConsentDialog.test.tsx`). Playwright lives in
  `e2e/` and mocks the API — it is not a live exam.

Prettier: print width 140, double quotes, trailing commas, semicolons.

## Errors, logs, secrets

- API failures that the UI should handle are `AppError` with a stable `code`
  (`CONSENT_REQUIRED`, `RATE_LIMITED`, …).
- Logs are JSON. Do not print raw transcripts, emails, or tokens. The
  observability package redacts known secret keys — still do not log them.
- Never commit `.env`, recordings, or learner data. CI runs Gitleaks.

## What “done” means

```sh
make check
```

That is `ruff check`, `pytest`, and the web `typecheck` / `lint` /
`format:check` / unit tests. CI also builds both images and runs Playwright.
If you change env vars, document them in `.env.example` and `docs/`.
If you change scoring or the examiner, run `make evals-replay` (and `make evals`
when the prompt changed).
