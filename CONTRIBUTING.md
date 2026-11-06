# Contributing

Thanks for helping improve this speaking-practice studio. This document is the
shortest path from a clone to a useful pull request.

Style, layout, and typing rules: **[docs/code-standards.md](docs/code-standards.md)**.
Behaviour for coding agents: **[AGENTS.md](AGENTS.md)**.

## Ground rules

- Keep secrets out of git. Copy `.env.example` to `.env` and fill keys locally.
- Do not commit production recordings, learner transcripts, or personal data.
- Match the style of the surrounding code. Prefer small, focused PRs.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- Docker
- [uv](https://docs.astral.sh/uv/)
- Node.js 22
- ffmpeg (for local audio normalisation)
- An [OpenRouter](https://openrouter.ai) API key, or another OpenAI-compatible
  endpoint (see [docs/models.md](docs/models.md))

Optional: `uvx pre-commit install` to run Ruff before each commit.

## Local setup

```sh
git clone <this-repo>
cd IELTS_SPEAKING
cp .env.example .env          # set OPENROUTER_API_KEY and a 32+ char AUTH_TOKEN_SECRET
docker compose up -d postgres redis minio minio-setup
uv sync --all-packages
uv run --env-file .env alembic upgrade head
```

Run the API, worker, and web app:

```sh
uv run --env-file .env uvicorn ielts_api.api:app --port 4000
uv run --env-file .env celery -A ielts_worker.tasks:celery_app worker --loglevel=info
cd apps/web && npm ci && npm run dev
```

Or start the full container stack with `docker compose up`. `make stack` is a
native (non-container) equivalent.

The web app talks to `VITE_API_BASE_URL` (default `http://localhost:4000/v1`).
In production nginx proxies `/v1` on the same origin.

## Checks

```sh
make check
```

That runs Ruff, pytest, and the web typecheck / lint / Prettier / Vitest
suite. CI also applies Alembic to an empty database, builds both images, and
runs Playwright.

```sh
# Integration tests that need Postgres (CI always does this):
TEST_DATABASE_URL=postgresql://ielts:ielts@127.0.0.1:5432/ielts_test uv run pytest -q
cd apps/web && npx playwright install chromium && npm run test:e2e
```

Live model evals spend a few cents and need a real key:

```sh
make evals            # scoring golden set, examiner cases, STT/TTS probes
make evals-replay     # offline check of committed recordings
```

See [evals/README.md](evals/README.md).

## Database changes

```sh
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

The CI job “Migrations apply from empty” runs `alembic upgrade head` against a
fresh database, so a broken revision fails the build.

## Pull requests

1. Branch from `main`.
2. Keep the diff reviewable — one concern per PR when you can.
3. Add or update tests for behaviour you change.
4. Run `make check`.
5. Fill in the PR template. Call out any new environment variables in
   `.env.example` and `docs/`.

## Security

See [SECURITY.md](SECURITY.md). Do not file public issues for vulnerabilities.
