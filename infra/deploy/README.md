# Deploy templates

Same four processes everywhere: **web**, **api**, **worker**, **beat**, plus
Postgres, Redis, and an S3-compatible bucket. Shared rules:
[docs/deploy.md](../../docs/deploy.md).

| Target | Path | Notes |
| --- | --- | --- |
| Laptop | [README](../../README.md#run-it-locally) | `docker compose up` or `make stack` |
| VPS / Docker | [`docker-compose.prod.yml`](../../docker-compose.prod.yml) · [docker.md](docker.md) | Builds the CI images. No TLS. |
| VPS + HTTPS | [caddy/](caddy/) · [`docker-compose.caddy.yml`](../../docker-compose.caddy.yml) | Overlay: Caddy terminates TLS in front of `web`. |
| VPS without Docker | [systemd/](systemd/) | uv + nginx + systemd units. |
| Kubernetes | [k8s/](k8s/) | Kustomize base. Bring your own Postgres/Redis/S3. |
| Railway | [railway.md](railway.md) | Four services + plugins. |
| Render | [render.yaml](render.yaml) · [render.md](render.md) | Blueprint. Object storage is external. |
| Fly.io | [fly/](fly/) | Four apps + Postgres + Upstash + Tigris. |
| DigitalOcean App Platform | [digitalocean/](digitalocean/) | App Spec. Object storage is external. |
| Coolify / Dokploy / Portainer | [compose-platforms.md](compose-platforms.md) | Point them at `docker-compose.prod.yml`. |
| Cloudflare Tunnel | [cloudflare.md](cloudflare.md) | No open 80/443 on the VPS. |
| GHCR images | [github-packages.md](github-packages.md) | Tag `v*` or `workflow_dispatch`. |

**A poor fit:** AWS Lambda, Cloud Run (one-shot HTTP), or any host that cannot
run a long WebSocket, a Celery worker, and exactly one beat replica together.

Required production env: [docs/deploy.md](../../docs/deploy.md#shared-production-rules).
Models: [docs/models.md](../../docs/models.md).
