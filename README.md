# IELTS Speaking by Hinterbuild

A speaking-practice studio: a learner talks through a three-part IELTS-style interview with an
AI examiner, the recording is transcribed and scored, and the report, progress charts, practice
plan, and leaderboard are served back through a React app.

```
apps/web        React 19 + Vite + Tailwind v4 + shadcn (Base UI)   → nginx image
apps/api        FastAPI (REST + WebSocket live room)                 → uvicorn
apps/worker     Celery worker (transcription, scoring) + beat (retention, provider probes)
packages/       config · domain · db (SQLAlchemy async + Alembic) · inference (OpenRouter STT/TTS/LLM,
                scoring, examiner prompts, probes) · audio (ffmpeg) · observability (JSON logs, Prometheus)
evals/          AI evals: scoring golden set, examiner question checks, STT/TTS probes
migrations/     Alembic revisions (run with `alembic upgrade head`)
infra/          Dockerfiles, docker-compose, Railway service configs
```

## Run it locally

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/), Node 22, ffmpeg, an OpenRouter key.

```sh
cp .env.example .env                 # fill OPENROUTER_API_KEY and AUTH_TOKEN_SECRET
docker compose up -d postgres redis minio minio-setup
uv sync --all-packages
uv run --env-file .env uvicorn ielts_api.api:app --port 4000      # AUTO_MIGRATE=true applies migrations
uv run --env-file .env celery -A ielts_worker.tasks:celery_app worker --loglevel=info
uv run --env-file .env celery -A ielts_worker.tasks:celery_app beat --loglevel=info
cd apps/web && npm ci && npm run dev                              # http://localhost:3000
```

`docker compose up` runs the whole stack in containers instead; `make stack` is the scripted
equivalent for a native dev loop. The web app talks to `VITE_API_BASE_URL`
(default `http://localhost:4000/v1`); in production nginx proxies `/v1` on the same origin.

Postgres already on 5432? Override the published port with a compose override file rather than
editing `docker-compose.yml`.

## Configuration

All settings are environment variables read by `packages/config` (`EnvironmentConfig`), documented
in `.env.example`. The ones that matter for safety:

| Variable | Purpose |
| --- | --- |
| `APP_ENV=production` | Hides API docs, enables HSTS, requires the rest of this table |
| `AUTH_TOKEN_SECRET` | HMAC secret for the JWT access/refresh cookies |
| `WEB_ORIGIN` (+ `CORS_EXTRA_ORIGINS`) | The only origins allowed for cross-site POSTs and the WebSocket |
| `CONSENT_VERSION` | Bump when terms/privacy change; every account must re-accept before the next test |
| `TESTS_PER_DAY_LIMIT` | Per-learner cap on new tests (default 10) |
| `TRUSTED_PROXY_HOPS` | How many `X-Forwarded-For` hops to trust for per-IP limits (1 on Railway) |
| `METRICS_TOKEN` | Bearer token for `/metrics` and `/health/providers` |
| `OPENROUTER_*_MODEL`, `OPENROUTER_TTS_FALLBACK_MODEL` | Primary and fallback models per stage |
| `ALERT_WEBHOOK_URL` | Receives a JSON alert when an STT/TTS probe fails |
| `RAW_AUDIO_RETENTION_DAYS`, `TRANSCRIPT_RETENTION_DAYS`, `REPORT_RETENTION_DAYS` | Retention windows applied by the hourly beat task |

## Security model (what the tests enforce)

- **Auth**: email + password, PBKDF2 hashes, short-lived access cookie and a refresh cookie scoped to
  `/v1/auth/refresh`; `SameSite=Lax` plus an Origin/Referer check on every unsafe method.
- **Consent**: recorded at sign-up (`consent_records` with version, IP, user agent) and enforced by
  `require_consent` on every route that records or processes audio; a version bump returns
  `403 CONSENT_REQUIRED` and the web app shows a blocking dialog.
- **Rate limits**: Redis sliding windows per IP on auth routes (10/min, 50/h), per user (300/min),
  per socket (60 msg/min), per-day test cap. Redis outage fails open with a metric.
- **Bounded input**: 64 KiB JSON bodies, per-answer and per-test audio caps verified against the
  stored object size, 16 KiB socket frames, three bad frames and the socket closes.
- **Prompt injection**: candidate text is sanitised and wrapped in delimiters; the scoring summary is
  rebuilt from server-owned rows only; examiner output that echoes the candidate, repeats a question,
  or carries instruction markers is rejected and regenerated. `evals/` keeps this honest.
- **Data lifecycle**: account deletion cascades through the schema and object storage; retention
  deletes raw audio, blanks transcripts, and expires reports on schedule.

## Tests

```sh
uv run ruff check .                                   # lint (CI gate)
uv run pytest -q                                      # unit + API tests; postgres tests skip without:
TEST_DATABASE_URL=postgresql://ielts:ielts@127.0.0.1:5432/ielts_test uv run pytest -q
cd apps/web && npm run lint && npm run format:check && npm test -- --run && npm run build
cd apps/web && npx playwright install chromium && npm run test:e2e     # mocked-API end-to-end
```

The API integration tests reset the disposable database with the real Alembic migrations, so a
broken migration fails the suite. `.github/workflows/ci.yml` runs all of the above and builds both
container images on every push and pull request.

## AI evals

```sh
make evals            # live: scoring golden set, examiner cases, STT/TTS probes (needs OPENROUTER_API_KEY)
make evals-replay     # offline: re-check the committed recordings against evals/thresholds.toml
```

See `evals/README.md`. The nightly `evals.yml` workflow re-records and uploads results. In
production the beat task `probe_providers` runs the STT/TTS probes every 30 minutes; the outcome is
at `GET /health/providers` (bearer `METRICS_TOKEN`) and in the `provider_probe_ok` gauges.

## Operations

| Endpoint | Meaning |
| --- | --- |
| `GET /health/live` | Process is up |
| `GET /health/ready` | 200 only when Postgres, Redis, and the bucket answer; 503 otherwise (Railway health check) |
| `GET /health/providers` | Last STT/TTS probe result; 503 when a provider is failing |
| `GET /metrics` | Prometheus: model calls/errors/fallbacks, rate limiting, consent refusals, probes |

Logs are JSON with PII redaction. Migrations: `uv run alembic upgrade head` (Railway runs it as the
API pre-deploy command). New revision: `uv run alembic revision --autogenerate -m "..."`.

## Deploy

Railway: four services from this repo plus managed Postgres, Redis, and a bucket. Step-by-step with
the variable checklist in [`infra/deploy/railway.md`](infra/deploy/railway.md).

Before launch: top up the OpenRouter balance (audio transcription is refused below $0.50 of credit),
set `CONSENT_VERSION` to the date the policies were last changed, and run `make evals` once against
the production models.
