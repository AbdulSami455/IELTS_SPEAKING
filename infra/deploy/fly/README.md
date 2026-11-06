# Deploying to Fly.io

Four Fly apps from this repo, plus [Fly Postgres](https://fly.io/docs/postgres/),
[Upstash Redis](https://fly.io/docs/upstash/redis/), and
[Tigris](https://fly.io/docs/tigris/) (S3-compatible).

## Apps

| App name (change these) | Config | Image |
| --- | --- | --- |
| `ielts-api` | [`api.toml`](api.toml) | `infra/Dockerfile.backend` |
| `ielts-worker` | [`worker.toml`](worker.toml) | same |
| `ielts-beat` | [`beat.toml`](beat.toml) | same |
| `ielts-web` | [`web.toml`](web.toml) | `apps/web/Dockerfile` |

## Order

```sh
fly postgres create --name ielts-pg
fly redis create --name ielts-redis
fly storage create --name ielts-audio   # Tigris; save the S3 credentials

fly launch --config infra/deploy/fly/api.toml --copy-config --no-deploy
fly launch --config infra/deploy/fly/worker.toml --copy-config --no-deploy
fly launch --config infra/deploy/fly/beat.toml --copy-config --no-deploy
fly launch --config infra/deploy/fly/web.toml --copy-config --no-deploy
```

Attach the database to api + worker:

```sh
fly postgres attach ielts-pg -a ielts-api
fly postgres attach ielts-pg -a ielts-worker
```

Set secrets on **api, worker, and beat** (same set):

```sh
fly secrets set -a ielts-api \
  APP_ENV=production \
  AUTH_MODE=jwt \
  AUTH_TOKEN_SECRET="$(openssl rand -hex 32)" \
  METRICS_TOKEN="$(openssl rand -hex 32)" \
  WEB_ORIGIN=https://ielts-web.fly.dev \
  CONSENT_VERSION=2026-10-12 \
  TRUSTED_PROXY_HOPS=1 \
  REDIS_URL=<upstash-url> \
  CELERY_BROKER_URL=<upstash-url> \
  MINIO_ENDPOINT=https://fly.storage.tigris.dev \
  MINIO_PUBLIC_ENDPOINT=https://fly.storage.tigris.dev \
  MINIO_ACCESS_KEY=<tigris-key> \
  MINIO_SECRET_KEY=<tigris-secret> \
  MINIO_REGION=auto \
  MINIO_FORCE_PATH_STYLE=true \
  MINIO_CANDIDATE_BUCKET=ielts-audio \
  MINIO_DERIVATIVE_BUCKET=ielts-audio \
  MINIO_EXAMINER_BUCKET=ielts-audio \
  INFERENCE_MODE=openrouter \
  OPENROUTER_API_KEY=<key>
```

Repeat `fly secrets set` for `ielts-worker` and `ielts-beat`, or use
`flyctl secrets import`. Model slugs: [docs/models.md](../../../docs/models.md).

Web:

```sh
fly secrets set -a ielts-web API_UPSTREAM=ielts-api.internal:4000
```

Migrate, then deploy:

```sh
fly deploy -c infra/deploy/fly/api.toml --ha=false
fly ssh console -a ielts-api -C "alembic upgrade head"
fly deploy -c infra/deploy/fly/worker.toml --ha=false
fly deploy -c infra/deploy/fly/beat.toml --ha=false
fly deploy -c infra/deploy/fly/web.toml
```

Keep **beat** at one machine (`scale count 1`). Point a custom domain at
`ielts-web` and update `WEB_ORIGIN`.
