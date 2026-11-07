# Agent notes

This is a uv + Vite monorepo for a self-hosted IELTS-style speaking studio.

- Python 3.13, Ruff line length 120, pytest. Web is React 19 in `apps/web`.
- Four production processes: **web** (nginx), **api** (FastAPI), **worker**
  (Celery), **beat** (Celery beat, exactly one replica). Plus Postgres, Redis,
  and S3-compatible storage.
- Inference is one OpenAI-compatible HTTP API (`OPENROUTER_*` env names even
  when the host is not OpenRouter).
- Do not commit `.env`, secrets, recordings, or learner data. Do not push.
  Do not make the repository public unless a human asked.
- Read [docs/code-standards.md](docs/code-standards.md) before changing
  layout, types, or error handling.
- Checks: `make check`. Live models: `make evals` (needs `OPENROUTER_API_KEY`).
- Deploy topology: [docs/deploy.md](docs/deploy.md). Templates: `infra/deploy/`.
