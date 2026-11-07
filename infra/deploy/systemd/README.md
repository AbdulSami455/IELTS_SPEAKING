# systemd (VPS without Docker)

Run the four processes on a Linux host with uv, Node, ffmpeg, nginx, Postgres,
Redis, and an S3-compatible bucket (MinIO on the same box is fine).

Prefer [Compose](../docker.md) unless you have a reason not to use Docker.

## Layout

```
/opt/ielts                 git checkout
/opt/ielts/.venv           uv venv (uv sync --frozen --all-packages)
/etc/ielts/ielts.env       production env (mode 0640, owner ielts)
/var/lib/ielts             beat schedule
```

Create the user, then copy the unit files:

```sh
sudo useradd --system --home /opt/ielts --shell /usr/sbin/nologin ielts
sudo install -d -o ielts -g ielts /opt/ielts /var/lib/ielts /etc/ielts
sudo cp infra/deploy/systemd/ielts-*.service /etc/systemd/system/
sudo cp .env /etc/ielts/ielts.env   # after filling production values
sudo chmod 640 /etc/ielts/ielts.env
```

`ielts.env` is the same keys as `.env.example` with `APP_ENV=production`.
Set `WEB_ORIGIN=https://speak.example.com` and `TRUSTED_PROXY_HOPS=1`.
API binds to **127.0.0.1:4000**; nginx is the public process.

## Web build

```sh
cd /opt/ielts/apps/web
npm ci
VITE_API_BASE_URL=/v1 npm run build
```

Install [nginx.conf](nginx.conf) as a site, replace `speak.example.com`,
obtain a certificate (`certbot --nginx`), then:

```sh
sudo -u ielts uv --directory /opt/ielts run alembic upgrade head
sudo systemctl daemon-reload
sudo systemctl enable --now ielts-api ielts-worker ielts-beat nginx
```

**Exactly one** `ielts-beat` instance.

## Updates

```sh
cd /opt/ielts && sudo -u ielts git pull
sudo -u ielts uv --directory /opt/ielts sync --frozen --all-packages
sudo -u ielts uv --directory /opt/ielts run alembic upgrade head
cd apps/web && sudo -u ielts npm ci && sudo -u ielts env VITE_API_BASE_URL=/v1 npm run build
sudo systemctl restart ielts-api ielts-worker ielts-beat
```
