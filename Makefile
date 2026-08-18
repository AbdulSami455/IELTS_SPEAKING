SHELL := /bin/zsh

.PHONY: infra-up infra-down db-seed worker stack compose-up compose-down

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
	zsh scripts/dev_stack.sh

compose-up:
	docker compose up --build

compose-down:
	docker compose down
