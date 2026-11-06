## Summary

<!-- What changed and why. -->

## Test plan

- [ ] `make check` (or `uv run ruff check .` and `uv run pytest -q`)
- [ ] Web: `npm run typecheck && npm run lint && npm run format:check && npm test -- --run` (from `apps/web`) if the UI changed
- [ ] Playwright (`npm run test:e2e`) if a learner-facing flow changed
- [ ] `make evals-replay` if scoring or the examiner changed
- [ ] I did not commit `.env`, API keys, recordings, or personal data
- [ ] New environment variables are documented in `.env.example` and `docs/`

## Notes

<!-- Migrations, model slug changes, deploy impact. -->
