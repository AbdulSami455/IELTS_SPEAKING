# Security policy

## Supported versions

Security fixes land on `main`. If you run a fork or a pinned release, merge or
cherry-pick from `main` promptly — especially around auth, uploads, and scoring.

## Report a vulnerability

Please **do not** open a public GitHub issue for security problems.

Use GitHub's private vulnerability reporting: [report a vulnerability](https://github.com/AbdulSami455/IELTS_SPEAKING/security/advisories/new). If you prefer email, write to **abdulsami6779@gmail.com**. Include:

- a short description of the issue and its impact
- steps to reproduce, or a proof of concept
- affected commit SHA or deploy date, if you know it
- whether you plan to disclose on a timeline

You should receive an acknowledgement within **5 business days**. We aim to
ship a fix or a public advisory within **90 days** of a confirmed report.

Good reports include (non-exhaustive): authentication/session bypass, access to
another learner's audio or reports, injection into examiner/scoring prompts that
changes bands, unsigned object-storage URLs that leak recordings, and secrets
committed to git.

## What is already in scope for operators

- Never commit `.env`, API keys, or production `AUTH_TOKEN_SECRET`.
- In production, `EnvironmentConfig.validate()` rejects placeholder MinIO keys,
  short JWT secrets, `INFERENCE_MODE=fake`, and localhost `WEB_ORIGIN`.
- `/metrics` and `/health/providers` require `Authorization: Bearer $METRICS_TOKEN`.
- Candidate speech is sanitised and wrapped before it reaches a model; evals in
  `evals/` watch for prompt-injection regressions.

## Known limitations

- Sign-up reports when an email is already registered (there is no email
  verification), so account existence can be probed. Auth endpoints are rate
  limited per IP and login timing does not reveal whether an email exists.
- Logging out revokes every token issued so far for that account. There is no
  per-device session list, so one logout signs out all devices.

## Secret scanning

CI runs Gitleaks on every push and pull request (`.github/workflows/secrets.yml`).
Run the same check locally:

```sh
docker run --rm -v "$PWD:/src" zricethezav/gitleaks:latest detect --source=/src --verbose
```
