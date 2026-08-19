#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
make infra-up
test -f .env || cp .env.example .env
echo "API :4000  worker celery  web :3000"
uv run celery -A ielts_worker.tasks:celery_app worker --loglevel=info &
uv run uvicorn ielts_api.api:app --reload --host 0.0.0.0 --port 4000 &
npm --prefix apps/web run dev
