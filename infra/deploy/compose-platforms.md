# Compose platforms (Coolify, Dokploy, Portainer, CapRover)

Any host that can run a Docker Compose file can run this app. Use
[`docker-compose.prod.yml`](../../docker-compose.prod.yml) as the source of
truth. Shared rules: [docs/deploy.md](../../docs/deploy.md).

## Coolify / Dokploy

1. New project → Docker Compose.
2. Point at this repository, compose file `docker-compose.prod.yml`.
3. Paste a production `.env` (never commit it). Required keys are in
   [railway.md](railway.md#variables--api-worker-beat-share-them-with-a-shared-variable-group)
   plus `MINIO_SECRET_KEY`.
4. Expose **web** (port 8080) through the platform's HTTPS proxy. Set
   `WEB_ORIGIN` to that `https://` URL and `TRUSTED_PROXY_HOPS=1`.
5. Watch the `migrate` service exit 0 before sending learners.

Beat must stay at one replica. If the platform has a "scale" slider, leave
beat at 1.

Object storage: either keep the MinIO service or delete it and point
`MINIO_*` at R2 / Tigris / S3.

## Portainer

Stacks → Add stack → upload `docker-compose.prod.yml` and an env file.
Publish 8080 (or 80/443 via [Caddy overlay](caddy/)).

## CapRover

CapRover prefers one app per process. Four apps from the two Dockerfiles is
closer to the [Render](render.md) / [Fly](fly/) shape than to Compose:

| App | Dockerfile | Command |
| --- | --- | --- |
| api | `infra/Dockerfile.backend` | `uvicorn ielts_api.api:app --host 0.0.0.0 --port 80 --proxy-headers --forwarded-allow-ips='*'` |
| worker | same | `celery -A ielts_worker.tasks:celery_app worker --loglevel=info --concurrency=2` |
| beat | same | `celery -A ielts_worker.tasks:celery_app beat --loglevel=info --schedule /tmp/celerybeat-schedule` |
| web | `apps/web/Dockerfile` | image default; `API_UPSTREAM=srv-captain--api:80` |

Attach managed Postgres and Redis. One-off `alembic upgrade head` on api
before the first request. CapRover's HTTPS goes on **web** only.

## What not to squeeze in

Heroku-style one-dyno, Cloud Run, App Runner, and Lambda cannot run the
WebSocket + worker + single beat trio cleanly. Use Compose, Kubernetes, or
one of the four-process PaaS templates instead.
