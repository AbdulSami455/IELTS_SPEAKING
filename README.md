# IELTS Speaking Practice

[![CI](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A three-part IELTS-style speaking studio. A learner talks with an AI examiner,
the recording is transcribed and scored, and the report, progress charts,
practice plan, and leaderboard come back through a React app.

**This is not an official IELTS test.** IELTS is a trademark of the British
Council, IDP, and Cambridge. Practice bands are coaching estimates only. See
[NOTICE](NOTICE).

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[React speaking room]
  end
  subgraph runtime [Your deployment]
    Web[nginx]
    API[FastAPI]
    Worker[Celery worker]
    Beat[Celery beat]
    PG[(Postgres)]
    RD[(Redis)]
    S3[(S3-compatible store)]
  end
  LLM[OpenAI-compatible models]
  UI --> Web
  Web -->|/v1| API
  API --> PG
  API --> RD
  API --> S3
  API --> LLM
  Worker --> PG
  Worker --> RD
  Worker --> S3
  Worker --> LLM
  Beat --> RD
```

| Path | What it is |
| --- | --- |
| `apps/web` | React 19 + Vite + Tailwind v4 + shadcn → nginx image |
| `apps/api` | FastAPI REST + WebSocket live room |
| `apps/worker` | Celery worker (transcription, scoring) + beat (retention, probes) |
| `packages/` | config, domain, db, inference, audio, observability |
| `evals/` | Scoring golden set, examiner checks, STT/TTS probes |
| `migrations/` | Alembic revisions |
| `infra/deploy/` | Railway, Render, Fly.io, Docker templates |
| `docs/` | [Models](docs/models.md) · [Deploy](docs/deploy.md) |

## Contents

- [Run it locally](#run-it-locally)
- [Models](#models)
- [Deploy](#deploy)
- [Configuration](#configuration)
- [Security](#security)
- [Tests](#tests)
- [Contributing](#contributing)

## Run it locally

Prerequisites: Docker, [uv](https://docs.astral.sh/uv/), Node 22, ffmpeg, and
an API key for [OpenRouter](https://openrouter.ai) (or another compatible host).

```sh
cp .env.example .env
# Set OPENROUTER_API_KEY and a 32+ character AUTH_TOKEN_SECRET
docker compose up -d postgres redis minio minio-setup
uv sync --all-packages
uv run --env-file .env alembic upgrade head
uv run --env-file .env uvicorn ielts_api.api:app --port 4000
uv run --env-file .env celery -A ielts_worker.tasks:celery_app worker --loglevel=info
cd apps/web && npm ci && npm run dev    # http://localhost:3000
```

`docker compose up` runs the whole stack in containers. `make stack` is the
native equivalent.

The web app talks to `VITE_API_BASE_URL` (default `http://localhost:4000/v1`).
In production nginx proxies `/v1` on the same origin so cookies stay first-party.

Postgres already bound on 5432? Override the published port with a Compose
override file rather than editing `docker-compose.yml`.

## Models

All inference goes through `OPENROUTER_BASE_URL` (OpenAI-compatible):

| Job | Variable | Default flavour |
| --- | --- | --- |
| Speech-to-text | `OPENROUTER_STT_MODEL` (+ `_FALLBACK_MODEL`) | Whisper / Qwen ASR |
| Examiner voice | `OPENROUTER_TTS_MODEL` (+ `_FALLBACK_MODEL`, `_VOICE`) | Kokoro / Deepgram / OpenAI TTS |
| Examiner questions | `REALTIME_LLM_MODEL` | Chat model |
| Band scoring | `OPENROUTER_SCORING_MODEL` (+ fallback) | Chat model that can return JSON |
| Pronunciation notes | `OPENROUTER_PRONUNCIATION_MODEL` | Chat model |

Swap OpenRouter for OpenAI, Groq, Together, Fireworks, vLLM, Ollama, or LiteLLM
by changing the base URL and slugs. Full matrix, examples, and pitfalls:
**[docs/models.md](docs/models.md)**.

## Deploy

Same four processes everywhere: **web**, **api**, **worker**, **beat**, plus
Postgres, Redis, and an S3-compatible bucket.

| Target | Start here |
| --- | --- |
| Any Linux host | [`docker-compose.prod.yml`](docker-compose.prod.yml) · [notes](infra/deploy/docker.md) |
| Railway | [infra/deploy/railway.md](infra/deploy/railway.md) |
| Render | [infra/deploy/render.yaml](infra/deploy/render.yaml) · [notes](infra/deploy/render.md) |
| Fly.io | [infra/deploy/fly/](infra/deploy/fly/) |
| Overview | [docs/deploy.md](docs/deploy.md) |

Before the first real learners: top up the model provider (audio calls are often
refused on an empty balance), set `CONSENT_VERSION` to the date your policies
changed, and run `make evals` once against the production slugs.

## Configuration

Settings are environment variables read by `packages/config`
(`EnvironmentConfig`). The template is [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `APP_ENV=production` | Hides API docs, enables HSTS, requires the rest of this table |
| `AUTH_TOKEN_SECRET` | HMAC secret for JWT cookies (≥ 32 characters) |
| `WEB_ORIGIN` | Public origin of the web app |
| `CONSENT_VERSION` | Bump to force re-consent |
| `TESTS_PER_DAY_LIMIT` | Per-learner cap on new tests |
| `TRUSTED_PROXY_HOPS` | `X-Forwarded-For` hops to trust (`1` behind Railway/Fly/Render) |
| `METRICS_TOKEN` | Bearer token for `/metrics` and `/health/providers` |
| `OPENROUTER_*` / `REALTIME_LLM_MODEL` | [docs/models.md](docs/models.md) |
| `ALERT_WEBHOOK_URL` | Slack/Discord JSON alert when an STT/TTS probe fails |
| `RAW_AUDIO_RETENTION_DAYS` | Hourly beat deletes raw audio after this many days |

## Security

- **Auth**: email + password, PBKDF2 hashes, short-lived access cookie and a
  refresh cookie scoped to `/v1/auth/refresh`; `SameSite=Lax` plus Origin/Referer
  checks on unsafe methods.
- **Consent**: recorded at sign-up and enforced on every route that records
  audio. A version bump returns `403 CONSENT_REQUIRED`.
- **Rate limits**: Redis sliding windows per IP, per user, per socket, plus a
  daily test cap.
- **Bounded input**: 64 KiB JSON bodies, per-answer and per-test audio caps,
  16 KiB socket frames.
- **Prompt injection**: candidate text is sanitised and delimited; scoring
  history is rebuilt from server-owned rows; examiner output that echoes the
  candidate or carries instruction markers is rejected. `evals/` keeps this
  honest.
- **Secrets**: local `.env` files are loaded only from this repository, never
  from a parent directory. CI runs Gitleaks. Report vulnerabilities privately —
  [SECURITY.md](SECURITY.md).

## Tests

```sh
uv run ruff check .
uv run pytest -q
TEST_DATABASE_URL=postgresql://ielts:ielts@127.0.0.1:5432/ielts_test uv run pytest -q
cd apps/web && npm run lint && npm run format:check && npm test -- --run && npm run build
cd apps/web && npx playwright install chromium && npm run test:e2e
```

API integration tests apply the real Alembic migrations. GitHub Actions runs
lint, pytest, Playwright, image builds, and a secret scan on every push and
pull request.

### AI evals

```sh
make evals            # live; needs OPENROUTER_API_KEY
make evals-replay     # offline replay of committed recordings
```

Details: [evals/README.md](evals/README.md). Production beat runs STT/TTS probes
every 30 minutes (`GET /health/providers`).

## Operations

| Endpoint | Meaning |
| --- | --- |
| `GET /health/live` | Process is up |
| `GET /health/ready` | Postgres, Redis, and the bucket answer |
| `GET /health/providers` | Last STT/TTS probe (Bearer `METRICS_TOKEN`) |
| `GET /metrics` | Prometheus |

Logs are JSON with PII redaction. New migration:

```sh
uv run alembic revision --autogenerate -m "describe the change"
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
Licensed under the [MIT License](LICENSE).
