SHELL := /bin/sh

.PHONY: infra-up infra-down db-seed worker stack compose-up compose-down
.PHONY: lint test check evals evals-replay

infra-up:
	docker compose -f infra/docker-compose.yml up -d
	@until docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U ielts >/dev/null 2>&1; do sleep 1; done

infra-down:
	docker compose -f infra/docker-compose.yml down

db-seed:
	uv run python scripts/seed_question_bank.py

worker:
	uv run celery -A ielts_worker.tasks:celery_app worker --loglevel=info

stack:
	sh scripts/dev_stack.sh

compose-up:
	docker compose up

compose-down:
	docker compose down

lint:
	uv run ruff check .
	cd apps/web && npm run typecheck && npm run lint && npm run format:check

test:
	uv run pytest -q
	cd apps/web && npm test -- --run

check: lint test

evals:
	uv run --env-file .env python evals/scoring/run.py --live --record
	uv run --env-file .env python evals/examiner/run.py --live --record
	uv run --env-file .env python -m ielts_inference.probes

evals-replay:
	uv run python evals/scoring/run.py --replay
	uv run python evals/examiner/run.py --replay
