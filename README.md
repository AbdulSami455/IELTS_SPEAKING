# IELTS Speaking Practice

[![CI](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12-3776AB.svg)](https://www.python.org/)
[![Node 22](https://img.shields.io/badge/node-22-339933.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/UI-React%2019-61DAFB.svg)](https://react.dev/)

**Hinterbuild** — a self-hosted IELTS-style speaking studio. A learner sits
with an AI examiner for Parts 1–3, the recording is transcribed and scored,
and the report, progress charts, practice plan, and leaderboard come back
through a React app.

> **This is not an official IELTS test.** IELTS is a trademark of the British
> Council, IDP, and Cambridge. Practice bands are coaching estimates only.
> See [NOTICE](NOTICE).

| | |
| --- | --- |
| **Live exam** | WebSocket speaking room, examiner TTS, mic capture, VAD |
| **Report** | Four IELTS criteria, per-answer notes, estimated overall band |
| **Progress** | Dashboard, history, practice plan, leaderboard |
| **Ops** | Postgres + Redis + S3, Celery, Prometheus, JSON logs |
| **Models** | Any OpenAI-compatible host (OpenRouter by default) |

## Contents

- [What you get](#what-you-get)
- [How a practice test works](#how-a-practice-test-works)
- [Architecture](#architecture)
- [Repository](#repository)
- [Run it locally](#run-it-locally)
- [Models](#models)
- [Deploy](#deploy)
- [Configuration](#configuration)
- [Security](#security)
- [Tests](#tests)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## What you get

A full speaking loop, not a chatbot demo:

1. **Sound check** — microphone permission and a short playback before the exam.
2. **Part 1** — short questions on familiar topics (home, work, study, habits).
3. **Part 2** — cue-card long turn: one minute to prepare, then ~1–2 minutes of
   uninterrupted speaking. The card stays on screen.
4. **Part 3** — follow-up discussion that stays on the Part 2 theme.
5. **Scoring** — Celery transcribes the audio, scores the four criteria, and
   writes a report the dashboard can chart.

The same session also produces:

- Per-answer transcripts and examiner audio you can replay.
- Fluency, vocabulary, grammar, and pronunciation notes.
- A practice plan derived from weak criteria.
- A daily test cap and consent record so a public instance stays bounded.

Typical sitting: **11–14 minutes**, then a few minutes of worker time for the
report.

## How a practice test works

```mermaid
sequenceDiagram
  actor Learner
  participant Web as React studio
  participant API as FastAPI
  participant LLM as Examiner LLM + TTS
  participant Worker as Celery
  participant STT as Speech-to-text
  participant Score as Scoring LLM

  Learner->>Web: Create account, accept consent
  Learner->>Web: Sound check
  Web->>API: Start test (WebSocket)
  loop Parts 1–3
    API->>LLM: Next question (JSON)
    LLM-->>Web: Examiner speech + transcript
    Learner->>Web: Speak
    Web->>API: Audio chunks
  end
  Web->>API: Submit test
  API->>Worker: Transcribe + score
  Worker->>STT: /audio/transcriptions
  Worker->>Score: /chat/completions (JSON schema)
  Worker-->>Web: Report ready
  Learner->>Web: Read band, notes, plan
```

| Part | Shape | Timing (practice) |
| --- | --- | --- |
| 1 | Interview on everyday topics | ~4–5 minutes |
| 2 | Cue card, prep, long turn | ~3–4 minutes |
| 3 | Abstract follow-ups on the Part 2 theme | ~4–5 minutes |

Scoring uses the public IELTS speaking criteria:

| Criterion | What the report comments on |
| --- | --- |
| Fluency & coherence | Hesitation, length, linking of ideas |
| Lexical resource | Range and precision of vocabulary |
| Grammatical range & accuracy | Sentence variety and error patterns |
| Pronunciation | Intelligibility, word stress, sounds that need work |

Bands are **estimates for coaching**. They are not official scores.

## Architecture

Four processes, three stores, one OpenAI-compatible model gateway.

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
  Web -->|/v1 and /health| API
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

What each process does:

| Process | Image | Role |
| --- | --- | --- |
| **web** | `apps/web/Dockerfile` (nginx) | SPA. In production it reverse-proxies `/v1` so cookies stay first-party. |
| **api** | `infra/Dockerfile.backend` | REST + WebSocket live room, auth, consent, rate limits. |
| **worker** | same backend image | Transcription, scoring, pronunciation notes. |
| **beat** | same backend image | Raw-audio retention, STT/TTS health probes every 30 minutes. |

The API never blocks the HTTP request on scoring. Submit returns immediately;
the worker writes the report; the UI polls until it is ready.

```mermaid
flowchart TB
  Submit[Test submitted] --> Queue[Redis / Celery]
  Queue --> Transcribe[STT primary then fallback]
  Transcribe --> Score[Scoring primary then fallback]
  Score --> Pron[Pronunciation notes — non-fatal]
  Pron --> Report[(Postgres report + answers)]
  Transcribe --> Audio[(S3 audio + derivatives)]
```

## Repository

Monorepo. Python packages are installed with [uv](https://docs.astral.sh/uv/);
the web app is a Vite project.

```
apps/web          React 19 + Vite + Tailwind v4 + shadcn → nginx image
apps/api          FastAPI REST + WebSocket
apps/worker       Celery worker + beat
packages/         config, domain, db, inference, audio, observability
evals/            Scoring golden set, examiner checks, STT/TTS probes
migrations/       Alembic revisions
infra/deploy/     Railway, Render, Fly.io, Docker notes
docs/             Models · Deploy · Maintainers
```

| Doc | When you need it |
| --- | --- |
| [docs/models.md](docs/models.md) | Swap OpenRouter for Groq, vLLM, Ollama, … |
| [docs/deploy.md](docs/deploy.md) | Production topology, env, health |
| [docs/maintainers.md](docs/maintainers.md) | Release and incident notes |
| [evals/README.md](evals/README.md) | How to run and extend AI evals |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, tests, PR bar |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability |

## Run it locally

You need **Docker**, **[uv](https://docs.astral.sh/uv/)**, **Node 22**,
**ffmpeg**, and an API key for [OpenRouter](https://openrouter.ai) (or any
host that speaks the OpenAI audio + chat HTTP API).

### 1. Environment

```sh
cp .env.example .env
```

Set at least:

```env
OPENROUTER_API_KEY=sk-or-...          # from https://openrouter.ai/keys
AUTH_TOKEN_SECRET=change-me-to-32-chars-minimum
```

Keep a few dollars of credit on the provider. Audio endpoints are often
refused on an empty balance (`403` / `402` / `429`).

### 2a. Fastest: one Compose stack

```sh
docker compose up --build
```

This starts Postgres, Redis, MinIO, the API, the worker, beat, and the web
app. Open **http://localhost:3000**.

### 2b. Native processes (hot reload)

```sh
docker compose up -d postgres redis minio minio-setup
uv sync --all-packages
uv run --env-file .env alembic upgrade head
uv run --env-file .env uvicorn ielts_api.api:app --port 4000
uv run --env-file .env celery -A ielts_worker.tasks:celery_app worker --loglevel=info
cd apps/web && npm ci && npm run dev
```

`make stack` is the same native path as a single target.

| Service | URL |
| --- | --- |
| Web (Vite) | http://localhost:3000 |
| API | http://localhost:4000/v1 |
| API docs (dev only) | http://localhost:4000/docs |
| MinIO console | http://localhost:9001 |

The web app talks to `VITE_API_BASE_URL` (default `http://localhost:4000/v1`).
In production nginx proxies `/v1` on the same origin.

Postgres already bound on 5432? Publish a different host port with a Compose
override rather than editing `docker-compose.yml`.

### 3. First session

1. Open the web app and create an account (email + password).
2. Accept the terms, privacy policy, and recording consent.
3. Allow the microphone when the browser asks.
4. Run the sound check, then start a full test.
5. Wait for the report after Part 3 — scoring is async.

There is no seeded demo user. You register locally like a learner.

## Models

All inference goes through **one** OpenAI-compatible base URL:

```mermaid
flowchart LR
  subgraph app [This app]
    Examiner[Examiner]
    STT[Speech-to-text]
    TTS[Text-to-speech]
    Score[Scoring]
    Pron[Pronunciation]
  end
  Gateway["OPENROUTER_BASE_URL"]
  Examiner -->|POST /chat/completions| Gateway
  Score -->|POST /chat/completions| Gateway
  Pron -->|POST /chat/completions| Gateway
  STT -->|POST /audio/transcriptions| Gateway
  TTS -->|POST /audio/speech| Gateway
```

| Job | Variable | Default flavour |
| --- | --- | --- |
| Speech-to-text | `OPENROUTER_STT_MODEL` (+ `_FALLBACK_MODEL`) | Whisper / Qwen ASR |
| Examiner voice | `OPENROUTER_TTS_MODEL` (+ `_FALLBACK_MODEL`, `_VOICE`) | Kokoro / Deepgram / OpenAI TTS |
| Examiner questions | `REALTIME_LLM_MODEL` | Chat model that returns JSON |
| Band scoring | `OPENROUTER_SCORING_MODEL` (+ fallback) | Chat model that returns the scoring schema |
| Pronunciation notes | `OPENROUTER_PRONUNCIATION_MODEL` | Chat model (failure is non-fatal) |

Copy-paste starting point (OpenRouter):

```env
INFERENCE_MODE=openrouter
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=
OPENROUTER_STT_MODEL=qwen/qwen3-asr-0.6b
OPENROUTER_STT_FALLBACK_MODEL=openai/whisper-tiny
OPENROUTER_TTS_MODEL=hexgrad/kokoro-82m
OPENROUTER_TTS_FALLBACK_MODEL=deepgram/aura-2-arcas-en
OPENROUTER_TTS_VOICE=af_heart
OPENROUTER_SCORING_MODEL=google/gemma-3-27b-it
OPENROUTER_SCORING_FALLBACK_MODEL=google/gemma-3-12b-it:free
OPENROUTER_PRONUNCIATION_MODEL=google/gemma-3-12b-it:free
REALTIME_LLM_MODEL=google/gemma-3-12b-it:free
```

Point `OPENROUTER_BASE_URL` at OpenAI, Groq, Together, Fireworks, vLLM,
Ollama, or LiteLLM and change the slugs. The env **names** stay
`OPENROUTER_*` even when the host is not OpenRouter.

`REALTIME_STT_MODEL` / `REALTIME_TTS_MODEL` are session labels for telemetry.
**Live HTTP STT/TTS always uses `OPENROUTER_STT_*` and `OPENROUTER_TTS_*`.**

Full matrix, provider examples, and pitfalls: **[docs/models.md](docs/models.md)**.

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

Production checklist (do this before the first real learner):

- [ ] `APP_ENV=production`
- [ ] `AUTH_TOKEN_SECRET` ≥ 32 random characters (not the example value)
- [ ] `WEB_ORIGIN` = the public HTTPS origin of the web app
- [ ] `CONSENT_VERSION` set to the date your policies last changed
- [ ] `TRUSTED_PROXY_HOPS=1` behind Railway / Render / Fly
- [ ] `METRICS_TOKEN` set (protects `/metrics` and `/health/providers`)
- [ ] Model provider funded; `make evals` run once against production slugs
- [ ] Migrations applied as a release step (`alembic upgrade head`)
- [ ] `AUTO_MIGRATE=false` in production

## Configuration

Settings are environment variables read by `packages/config`
(`EnvironmentConfig`). The template is [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `APP_ENV=production` | Hides API docs, enables HSTS, requires the rest of this table |
| `AUTH_TOKEN_SECRET` | HMAC secret for JWT cookies (≥ 32 characters) |
| `WEB_ORIGIN` | Public origin of the web app |
| `CORS_EXTRA_ORIGINS` | Extra browser origins (leave empty in production) |
| `CONSENT_VERSION` | Bump to force every learner to re-consent |
| `TESTS_PER_DAY_LIMIT` | Per-learner cap on new tests |
| `TRUSTED_PROXY_HOPS` | `X-Forwarded-For` hops to trust (`1` behind Railway/Fly/Render) |
| `METRICS_TOKEN` | Bearer token for `/metrics` and `/health/providers` |
| `OPENROUTER_*` / `REALTIME_LLM_MODEL` | [docs/models.md](docs/models.md) |
| `ALERT_WEBHOOK_URL` | Slack/Discord JSON alert when an STT/TTS probe fails |
| `RAW_AUDIO_RETENTION_DAYS` | Hourly beat deletes raw audio after this many days |
| `TRANSCRIPT_RETENTION_DAYS` / `REPORT_RETENTION_DAYS` | Later retention passes |
| `PAID_DAILY_BUDGET_USD` / `PAID_TEST_COST_CEILING_USD` | Soft cost rails |

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

Do not commit `.env`, provider keys, or dumps of learner audio.

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

| Endpoint | Auth | Meaning |
| --- | --- | --- |
| `GET /health/live` | none | Process is up |
| `GET /health/ready` | none | Postgres, Redis, and the bucket answer |
| `GET /health/providers` | Bearer `METRICS_TOKEN` | Last STT/TTS probe |
| `GET /metrics` | Bearer `METRICS_TOKEN` | Prometheus |

Logs are JSON with PII redaction.

New migration:

```sh
uv run alembic revision --autogenerate -m "describe the change"
```

Apply:

```sh
uv run --env-file .env alembic upgrade head
```

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Compose fails on Postgres port | Host `5432` already in use | Publish another port via a Compose override; do not edit the committed file |
| Web loads, login fails / CORS | `WEB_ORIGIN` or `VITE_API_BASE_URL` mismatch | Local Vite → `http://localhost:4000/v1`; production → same-origin `/v1` |
| Examiner has no voice / TTS 429 | Empty provider balance or a model that is not TTS | Fund the key; set `OPENROUTER_TTS_MODEL` to a `/audio/speech` slug |
| Mic works but answers are empty | Browser permission, or VAD cutting too early | Re-run the sound check; speak through the beep; check the worker logs |
| Test finishes, report stays “scoring” | Worker down, or scoring model returned non-JSON | `docker compose logs worker`; confirm `OPENROUTER_SCORING_MODEL` |
| `403 CONSENT_REQUIRED` | `CONSENT_VERSION` changed | Sign in and accept the new consent screen |
| `/docs` missing in production | Expected | `APP_ENV=production` hides OpenAPI |

Worker logs are the first place to look after a failed sitting. Scoring errors
are persisted on the test row so the UI can show a real failure instead of
spinning forever.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Licensed under the [MIT License](LICENSE).

Support: [support@hinterbuild.com](mailto:support@hinterbuild.com).
