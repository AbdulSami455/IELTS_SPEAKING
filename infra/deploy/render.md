# Deploying to Render

Render can run the four app processes and managed Postgres + Redis. Object
storage is **not** included — create a Cloudflare R2, AWS S3, or Tigris bucket
first.

## Blueprint

1. Create the bucket. Note endpoint, keys, region, and name.
2. In Render: **New → Blueprint**. Connect this Git repository and select
   [`infra/deploy/render.yaml`](render.yaml).
3. Fill the `sync: false` variables when prompted:
   - `OPENROUTER_API_KEY`
   - `MINIO_ENDPOINT` / `MINIO_PUBLIC_ENDPOINT` (R2 example:
     `https://<accountid>.r2.cloudflarestorage.com`)
   - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`
   - `MINIO_*_BUCKET` (one name is enough for all three)
   - `WEB_ORIGIN` — set this **after** the first web deploy to
     `https://<ielts-web>.onrender.com` (or your custom domain), then
     **Manual Deploy** the API.
4. Create an environment group `ielts-models` with the `OPENROUTER_*` and
   `REALTIME_LLM_MODEL` values from [docs/models.md](../../docs/models.md).
   Duplicate the API’s database/redis/minio/auth vars into a group
   `ielts-backend` and attach it to worker + beat (the YAML references both
   groups). If the groups do not exist yet, create them in the dashboard
   before the first deploy, or paste the same env vars onto worker and beat.
5. Run a one-off **Shell** on `ielts-api`: `alembic upgrade head`.
6. Smoke test as in [docs/deploy.md](../../docs/deploy.md).

`TRUSTED_PROXY_HOPS=1`. Do not set `AUTO_MIGRATE`.

Custom domain: attach it to **ielts-web** only. Keep `API_UPSTREAM` pointed at
the private API service so cookies stay first-party.

## Without the blueprint

Create four Docker services from `infra/Dockerfile.backend` and
`apps/web/Dockerfile`, plus Postgres and Redis, and copy the variable list
from [`railway.md`](railway.md).
