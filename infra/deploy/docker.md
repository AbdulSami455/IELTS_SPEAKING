# Docker Compose (production)

Use this on a VPS, a single Kubernetes node with Compose, or any host that can
run Docker. It builds the same images CI builds.

```sh
cp .env.example .env
# Fill APP_ENV=production, secrets, OPENROUTER_API_KEY, WEB_ORIGIN, AUTH_TOKEN_SECRET (≥32 chars)
docker compose -f docker-compose.prod.yml up -d --build
```

What you get:

- Postgres, Redis, MinIO on a private Compose network
- `migrate` runs `alembic upgrade head` once, then exits
- `api`, `worker`, `beat`, `web` (nginx on host port **8080**)

Open `http://localhost:8080`. For HTTPS, add the Caddy overlay:

```sh
# .env: DOMAIN=speak.example.com  ACME_EMAIL=you@example.com
#       WEB_ORIGIN=https://speak.example.com  TRUSTED_PROXY_HOPS=1
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --build
```

See [caddy/](caddy/). Traefik, host nginx, or [Cloudflare Tunnel](cloudflare.md)
work the same way: terminate TLS at the edge and keep `TRUSTED_PROXY_HOPS` in
line with how many proxies add `X-Forwarded-For` (usually `1`).

```sh
# Logs
docker compose -f docker-compose.prod.yml logs -f api worker

# Migrate after a new revision
docker compose -f docker-compose.prod.yml run --rm migrate

# Stop
docker compose -f docker-compose.prod.yml down
```

Replace MinIO with hosted S3/R2/Tigris by deleting the `minio` service and
setting `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, and
`MINIO_FORCE_PATH_STYLE` in `.env` (`false` for AWS virtual-host style).
