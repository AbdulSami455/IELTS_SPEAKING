# Deploying to Railway

Four services from one repo, plus managed Postgres, Redis, and an S3-compatible bucket.

| Service | Config file (set "Config file path" in service settings) | Notes |
|---|---|---|
| `api` | `infra/deploy/railway/api.json` | Runs `alembic upgrade head` before each deploy; health check `/health/ready`. |
| `worker` | `infra/deploy/railway/worker.json` | Celery worker (scoring, transcription). Scale replicas freely. |
| `beat` | `infra/deploy/railway/beat.json` | Celery beat (retention, provider probes). **Exactly one replica.** |
| `web` | `infra/deploy/railway/web.json` | nginx serving the SPA and proxying `/v1` + `/health` to `api` over the private network. Public domain goes here. |

The web service proxies the API under the same origin, so cookies are first-party
(`SameSite=Lax`) and no CORS configuration is needed. Only `web` needs a public domain.

## Order

1. Create the project; add **Postgres** and **Redis** plugins.
2. Add a **Bucket** (S3-compatible). Note its endpoint, access key, secret, region, and bucket name. One bucket is enough: set all three `MINIO_*_BUCKET` variables to it (keys never collide).
3. Create `api`, `worker`, `beat`, `web` from this repo; set each service's config file path from the table.
4. Set variables (below). Use Railway references for the plugins (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`).
5. Deploy `api` first (watch the pre-deploy migration log), then the others.
6. Generate a domain on `web`; set `WEB_ORIGIN` on `api` to that `https://` URL and redeploy `api`.
7. Smoke test: register (consent boxes), mic check, a full spoken test, report, progress, leaderboard, `GET /health/ready` (all three checks `ok`), `GET /health/providers` with the metrics token.

## Variables — api, worker, beat (share them with a shared variable group)

Required:

```
APP_ENV=production
AUTH_MODE=jwt
AUTH_TOKEN_SECRET=<64 random chars>
WEB_ORIGIN=https://<your web domain>
CONSENT_VERSION=2026-10-12
METRICS_TOKEN=<random>
TRUSTED_PROXY_HOPS=1
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
MINIO_ENDPOINT=https://<bucket endpoint host>
MINIO_PUBLIC_ENDPOINT=https://<bucket endpoint host>
MINIO_ACCESS_KEY=<bucket access key>
MINIO_SECRET_KEY=<bucket secret>
MINIO_REGION=<bucket region, e.g. auto or us-east-1>
MINIO_FORCE_PATH_STYLE=true
MINIO_CANDIDATE_BUCKET=<bucket name>
MINIO_DERIVATIVE_BUCKET=<bucket name>
MINIO_EXAMINER_BUCKET=<bucket name>
INFERENCE_MODE=openrouter
OPENROUTER_API_KEY=<key>
```

Recommended (defaults exist):

```
OPENROUTER_STT_MODEL / OPENROUTER_STT_FALLBACK_MODEL
OPENROUTER_TTS_MODEL / OPENROUTER_TTS_FALLBACK_MODEL / OPENROUTER_TTS_VOICE
OPENROUTER_SCORING_MODEL / OPENROUTER_SCORING_FALLBACK_MODEL / OPENROUTER_PRONUNCIATION_MODEL
REALTIME_LLM_MODEL / REALTIME_STT_MODEL / REALTIME_TTS_MODEL / REALTIME_TTS_VOICE
RAW_AUDIO_RETENTION_DAYS=7  TRANSCRIPT_RETENTION_DAYS=30  REPORT_RETENTION_DAYS=365
UPLOAD_MAX_BYTES_PER_ANSWER=26214400  UPLOAD_MAX_BYTES_PER_TEST=104857600
TESTS_PER_DAY_LIMIT=10
FREE_REQUEST_DAILY_HARD_LIMIT=1000  FREE_REQUEST_DAILY_SOFT_LIMIT=800
PAID_DAILY_BUDGET_USD=5  PAID_TEST_COST_CEILING_USD=0.035
ALERT_WEBHOOK_URL=<Slack/Discord webhook for probe failures>
LOG_LEVEL=info
CORS_EXTRA_ORIGINS=            (leave empty)
```

Never set `AUTO_MIGRATE` in production; migrations run from the pre-deploy command.

## Variables — web

```
PORT=8080                         (Railway injects PORT; keep the Dockerfile default otherwise)
API_UPSTREAM=api.railway.internal:4000
```

`api.railway.internal` is the private hostname of the `api` service; its port is the
`PORT` the api service listens on (4000 by default — set `PORT=4000` on `api` to be explicit).

## Operations

- **Rollback:** redeploy the previous image from the service's deploy history. If a migration
  must be undone: `alembic downgrade -1` from a one-off shell on `api`.
- **Force re-consent:** bump `CONSENT_VERSION` on `api`; every learner sees the consent dialog
  before their next test.
- **Metrics:** `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN`.
- **Provider health:** `GET /health/providers` (same token) shows the last STT/TTS probe.
- **Retention:** beat runs `reconcile_retention` hourly; raw audio is removed after
  `RAW_AUDIO_RETENTION_DAYS`, transcripts blanked after `TRANSCRIPT_RETENTION_DAYS`.
