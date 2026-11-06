# Maintainer notes (before you make the repository public)

Do these yourself. This file is a checklist, not an automated publish step.

1. **Keep the GitHub repository private** until the list below is done.
2. **Do not commit `.env`.** `git ls-files .env` must stay empty.
3. **Rotate** any OpenRouter (or other) API keys that ever lived in a local
   `.env`, even if that file was gitignored.
4. **Git author identity.** Existing commits use a personal student email.
   If you do not want that address public, rewrite authors to a GitHub
   `noreply` address *before* the first public push (`git filter-repo` or
   BFG). History rewrite is destructive; only you should run it.
5. Confirm GitHub Actions secrets: `OPENROUTER_API_KEY` for nightly evals.
   Repository **variables** (`vars.*`) must not hold keys. GHCR images from
   `publish-images.yml` stay private until you change package visibility.
6. Set the GitHub description, topics, and LICENSE detection (MIT is already
   in the tree).
7. Add a real `CODEOWNERS` file if you want review gates.
8. Re-read [NOTICE](../NOTICE) (IELTS trademark) and the in-app legal pages.

This project will **not** push or change repository visibility for you.
