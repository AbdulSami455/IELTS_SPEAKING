<p align="center">
  <img src="docs/assets/mark.svg" width="56" height="56" alt="Hinterbuild" />
</p>

# IELTS Speaking Practice

[![CI](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdulSami455/IELTS_SPEAKING/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.13](https://img.shields.io/badge/python-3.13-3776AB.svg)](https://www.python.org/)
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

<p align="center">
  <img src="docs/assets/studio.svg" width="420" alt="The speaking studio — a learner at the microphone" />
</p>

| | |
| --- | --- |
| **Live exam** | WebSocket speaking room, examiner TTS, mic capture, VAD |
| **Report** | Four IELTS criteria, per-answer notes, estimated overall band |
| **Progress** | Dashboard, history, practice plan, leaderboard |
| **Ops** | Postgres + Redis + S3, Celery, Prometheus, JSON logs |
| **Models** | Any OpenAI-compatible host (OpenRouter by default) |

## Contents

- [Who this is for](#who-this-is-for)
- [What you get](#what-you-get)
- [How a practice test works](#how-a-practice-test-works)
- [Architecture](#architecture)
- [Repository](#repository)
- [Run it locally](#run-it-locally)
- [Models](#models)
- [Deploy](#deploy)
- [Code quality](#code-quality)
- [Configuration](#configuration)
- [What is stored](#what-is-stored)
- [Security](#security)
- [Tests](#tests)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)

## Who this is for

| You | Why this repo |
| --- | --- |
| A teacher, lab, or bootcamp | Run a private speaking studio on your own machines |
| A developer who wants a real speaking loop | Mic → examiner → STT → band report, not a chat demo |
| Someone self-hosting study tools | MIT-licensed, Docker Compose, Railway / Render / Fly templates |

It is **not** an official exam, a drop-in replacement for a human examiner, or
a hosted SaaS you log into. You operate the instance. Learners register on
*your* deployment.

You do **not** need a GPU. All inference is HTTP to an OpenAI-compatible API.

## What you get

A full speaking loop, not a chatbot demo:

1. **Sound check** — microphone permission and a short playback before the exam.
2. **Part 1** — short questions on familiar topics (home, work, study, habits).
3. **Part 2** — cue-card long turn: one minute to prepare, then ~1–2 minutes of
   uninterrupted speaking. The card stays on screen.
4. **Part 3** — follow-up discussion that stays on the Part 2 theme.
5. **Scoring** — Celery transcribes the audio, scores the four criteria, and
   writes a report the dashboard can chart.

<p align="center">
  <img src="docs/assets/feedback.svg" width="380" alt="Feedback notes for the next conversation" />
</p>

The same session also produces:

- Per-answer transcripts and examiner audio you can replay.
- Fluency, vocabulary, grammar, and pronunciation notes.
- A practice plan derived from weak criteria.
- A daily test cap and consent record so a public instance stays bounded.

Typical sitting: **11–14 minutes**, then a few minutes of worker time for the
report.

```mermaid
flowchart LR
  A[Sound check] --> B[Part 1 interview]
  B --> C[Part 2 cue card]
  C --> D[Part 3 discussion]
  D --> E[Async scoring]
  E --> F[Report + plan]
```

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

### Known limitations of scoring

- In the eval set, the default scoring model compresses the scale by about half a
  band at the extremes: very weak speech tends to score slightly high, very strong
  speech slightly low. The golden ranges in `evals/scoring/golden/` encode this, so a
  larger gap fails `make evals-replay`.
- Pronunciation is judged from pace, pauses, and recognition confidence. There is no
  phoneme-level assessment, and accent is never treated as an error.
- Results depend on the models you configure. Re-run `make evals` after changing a
  model or a prompt, and read [docs/models.md](docs/models.md).

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
infra/deploy/     Railway, Render, Fly, Docker, k8s, systemd, Caddy, DO
docs/             Models · Deploy · Code standards · Maintainers
docs/assets/      README illustrations
```

| Doc | When you need it |
| --- | --- |
| [docs/models.md](docs/models.md) | Swap OpenRouter for Groq, vLLM, Ollama, … |
| [docs/deploy.md](docs/deploy.md) | Production topology, env, health |
| [infra/deploy/README.md](infra/deploy/README.md) | Every deploy template |
| [docs/code-standards.md](docs/code-standards.md) | Python and TypeScript conventions |
| [docs/maintainers.md](docs/maintainers.md) | Release and incident notes |
| [evals/README.md](evals/README.md) | How to run and extend AI evals |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, tests, PR bar |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability |

Useful Make targets:

| Target | What it runs |
| --- | --- |
| `make check` | Ruff + pytest + web typecheck / lint / Prettier / Vitest |
| `make lint` / `make test` | The two halves of `check` |
| `make compose-up` | `docker compose up` |
| `make stack` | Native API + worker + web (`scripts/dev_stack.sh`) |
| `make worker` | Celery worker only |
| `make evals` | Live scoring + examiner + STT/TTS probes |
| `make evals-replay` | Offline replay of committed recordings |

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
| MinIO console | http://localhost:9001 (`minio` / `minio-development-only`) |

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

Optional: load extra cue cards with `make db-seed` (needs the API database
already migrated).

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

The client refuses to start without a non-empty `OPENROUTER_API_KEY`, even
against a local server that ignores it. Use a placeholder.

Not every host implements `/audio/transcriptions` and `/audio/speech`. If a
host only does chat, put a gateway (OpenRouter, LiteLLM) in front — this
codebase talks to **one** base URL for all five jobs.

Full matrix, provider examples, and pitfalls: **[docs/models.md](docs/models.md)**.

## Deploy

Same four processes everywhere: **web**, **api**, **worker**, **beat**, plus
Postgres, Redis, and an S3-compatible bucket. Catalogue:
[infra/deploy/README.md](infra/deploy/README.md).

| Target | Start here |
| --- | --- |
| VPS (Docker) | [`docker-compose.prod.yml`](docker-compose.prod.yml) · [notes](infra/deploy/docker.md) |
| VPS + HTTPS | [Caddy overlay](infra/deploy/caddy/) · [`docker-compose.caddy.yml`](docker-compose.caddy.yml) |
| VPS without Docker | [systemd units + nginx](infra/deploy/systemd/) |
| Kubernetes | [Kustomize base](infra/deploy/k8s/) |
| Railway | [infra/deploy/railway.md](infra/deploy/railway.md) |
| Render | [infra/deploy/render.yaml](infra/deploy/render.yaml) · [notes](infra/deploy/render.md) |
| Fly.io | [infra/deploy/fly/](infra/deploy/fly/) |
| DigitalOcean App Platform | [infra/deploy/digitalocean/](infra/deploy/digitalocean/) |
| Coolify / Dokploy / Portainer | [infra/deploy/compose-platforms.md](infra/deploy/compose-platforms.md) |
| Cloudflare Tunnel | [infra/deploy/cloudflare.md](infra/deploy/cloudflare.md) |
| Publish images | [GHCR](infra/deploy/github-packages.md) (`v*` tag or workflow_dispatch) |
| Overview | [docs/deploy.md](docs/deploy.md) |

A poor fit: AWS Lambda, Cloud Run, or any host that cannot keep a WebSocket,
a Celery worker, and **one** beat replica running together.

Production checklist (do this before the first real learner):

- [ ] `APP_ENV=production`
- [ ] `AUTH_TOKEN_SECRET` ≥ 32 random characters (`openssl rand -hex 32`)
- [ ] `WEB_ORIGIN` = the public HTTPS origin of the web app
- [ ] `CONSENT_VERSION` set to the date your policies last changed
- [ ] `TRUSTED_PROXY_HOPS=1` behind one TLS edge (Caddy, Railway, Fly, Cloudflare, …)
- [ ] `METRICS_TOKEN` set (protects `/metrics` and `/health/providers`)
- [ ] Model provider funded; `make evals` run once against production slugs
- [ ] Migrations applied as a release step (`alembic upgrade head`)
- [ ] `AUTO_MIGRATE=false` in production
- [ ] Exactly **one** `beat` replica
- [ ] Web has `API_UPSTREAM` so nginx can proxy `/v1`

Object storage is S3-compatible. You do not have to run MinIO in production;
set `MINIO_*` to R2, Tigris, AWS S3, or a Railway/Fly bucket. One bucket is
enough if the three logical names share it — object keys do not collide.

## Code quality

The written bar is [docs/code-standards.md](docs/code-standards.md).
Contributors: [CONTRIBUTING.md](CONTRIBUTING.md). Agents: [AGENTS.md](AGENTS.md).

| Layer | Tool | CI |
| --- | --- | --- |
| Python lint | Ruff (`E4`, `E7`, `E9`, `F`), line length 120 | `uv run ruff check .` |
| Python tests | pytest (+ Alembic on an empty DB) | `uv run pytest -q` |
| TypeScript | `tsc --noEmit`, ESLint, Prettier | web job |
| Web tests | Vitest + Playwright (mocked API) | web job |
| Images | backend + web Dockerfiles | build, no push on PR |
| Secrets | Gitleaks | every push / PR |
| Images to GHCR | optional | tag `v*` or `workflow_dispatch` |

```sh
make check                          # ruff + pytest + web lint/typecheck/vitest
uvx pre-commit install              # optional git hooks (Ruff + basic file checks)
```

Python is **3.13**. Node is **22**. Do not commit `.env`, recordings, or learner data.

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

## What is stored

| Data | Where | Default lifetime |
| --- | --- | --- |
| Email, password hash, consent version | Postgres | Until the account is deleted |
| Test metadata, band report, practice plan | Postgres | `REPORT_RETENTION_DAYS` (365) |
| Answer transcripts | Postgres | Blanked after `TRANSCRIPT_RETENTION_DAYS` (30) |
| Candidate audio + derivatives | S3-compatible bucket | Deleted after `RAW_AUDIO_RETENTION_DAYS` (7) |
| Examiner TTS clips | S3-compatible bucket | Kept with the session (not in the raw-audio pass) |
| Rate-limit counters, Celery broker | Redis | Ephemeral |

Celery beat runs retention hourly. Abandoned tests stuck in
`CREATED` / `DEVICE_CHECK` / `READY` expire so they stop counting as
resumable.

Recording only happens after the learner accepts consent. Bumping
`CONSENT_VERSION` forces a new acceptance before the next sitting.

Do not commit `.env`, provider keys, or dumps of learner audio.

### If you run this for other people

You become responsible for their data. Voice recordings and transcripts are personal
data in most jurisdictions, and each practice test sends audio and text to your
configured model provider. Before opening a deployment to the public:

- Replace the operator name, support email, and legal pages with your own (see the
  `VITE_OPERATOR_NAME`, `VITE_SUPPORT_EMAIL`, `VITE_LEGAL_UPDATED` variables in
  `.env.example`) and have the terms and privacy text reviewed for your jurisdiction.
- Name the model provider in your privacy policy and check its data-retention terms.
- Keep the retention windows above in line with what your policy promises.

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
make check
TEST_DATABASE_URL=postgresql://ielts:ielts@127.0.0.1:5432/ielts_test uv run pytest -q
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

Logs are JSON with PII redaction. Point platform health checks at
`/health/ready` on **api** and `/` on **web**.

New migration:

```sh
uv run alembic revision --autogenerate -m "describe the change"
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
| API will not start, empty key | `OPENROUTER_API_KEY` is blank | Set a real key or a placeholder for local gateways |

Worker logs are the first place to look after a failed sitting. Scoring errors
are persisted on the test row so the UI can show a real failure instead of
spinning forever.

## FAQ

**Is this an official IELTS test?**
No. It is independent practice software. Do not present scores as official
results. See [NOTICE](NOTICE).

**Can I use it commercially?**
The code is [MIT](LICENSE). You may run it for a class or product. You may
**not** imply endorsement by the British Council, IDP, or Cambridge, and you
must respect model-provider terms for any API you call.

**Do I need OpenRouter?**
No. Any host that implements OpenAI `/chat/completions`,
`/audio/transcriptions`, and `/audio/speech` works. Change
`OPENROUTER_BASE_URL` and the slugs. Details in [docs/models.md](docs/models.md).

**Do I need a GPU?**
No. The app calls out over HTTP. Self-hosting vLLM/Ollama is optional.

**Is there a demo account?**
No. Register on your instance after accepting consent.

**Does it work on a phone?**
The UI is responsive. A sitting still needs a microphone the browser can use,
and a stable connection for the WebSocket.

**Why did scoring fail after a good conversation?**
The worker or the scoring model failed, not the exam itself. Check worker
logs. Failed tests still land in the database with an error the UI can show.

**How much does a test cost?**
Depends entirely on the models you pick. Soft rails
`PAID_DAILY_BUDGET_USD` and `PAID_TEST_COST_CEILING_USD` are in `.env.example`.
Run `make evals` on your slugs before inviting learners.

**Can I run this on Kubernetes / a bare VPS / Coolify?**
Yes. Start at [infra/deploy/README.md](infra/deploy/README.md). Compose +
Caddy is the shortest path to HTTPS on a VPS. Kustomize is the shortest
path on a cluster (bring your own Postgres, Redis, and bucket).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/code-standards.md](docs/code-standards.md),
and the [Code of Conduct](CODE_OF_CONDUCT.md).

Licensed under the [MIT License](LICENSE).

Support: [support@hinterbuild.com](mailto:support@hinterbuild.com).
