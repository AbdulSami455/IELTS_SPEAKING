# IELTS-style speaking practice — working spec

Practice product only. Not official IELTS. Never invent a band.

## Run

Docker (API, worker, web, Postgres, Redis, MinIO):

```bash
cp .env.example .env   # set OPENROUTER_API_KEY
docker compose up --build
```

UI: http://localhost:3000  API docs: http://localhost:4000/v1/docs  MinIO console: http://localhost:9001

Local uv/npm (infra only in Docker):

```bash
cp .env.example .env   # set OPENROUTER_API_KEY
uv sync
npm --prefix apps/web install
make infra-up          # Postgres, Redis, MinIO
make worker            # Celery scoring
uv run uvicorn ielts_api.api:app --reload --host 0.0.0.0 --port 4000
npm --prefix apps/web run dev
```

Or `make stack`. Register or sign in on `/login`. Restart API and worker after changing `.env` models.

## Flow

1. Sign in (email + password). Each account has its own tests, reports, and progress.
2. Consent → mic check (record + playback).
3. Start the spoken exam. The AI examiner asks Part 1 questions in audio, based on prior answers.
4. Part 2: one minute prep, then a long turn with an optional spoken rounding question.
5. Part 3: discussion prompts generated from what the candidate already said.
6. Browser PUT to private MinIO. API validates, transcribes, and generates the next examiner turn.
7. Submit enqueues Celery. Worker: acoustics + pronunciation from audio; grammar/vocabulary from transcript; assemble report.
8. Report: four criteria, mistakes with quotes/corrections, fluency notes, transcripts, pronunciation findings.
9. Progress: tests completed, latest band, trend, per-criterion averages, weakest skill, practice actions.

Failure = FAILED, not a fake score.

## Layout

- `apps/web` — sign-in, runner, device check, processing, report, progress
- `apps/api` — FastAPI `/v1` (auth, sessions, upload, examiner TTS, reports)
- `apps/worker` — Celery `evaluate_test_task` + retention
- `packages/domain` — session/answer states, band rounding
- `packages/db` — SQLAlchemy models, MinIO keys/store
- `packages/inference` — OpenRouter STT/TTS/score/pronunciation/examiner turn generation, assembler
- `packages/audio` — ffmpeg normalize, WAV quality, acoustic observations
- `packages/config` — `.env` loader
- `config/question-banks` — optional legacy seed content
- `infra/docker-compose.yml` — local Postgres, Redis, MinIO (uv/npm workflow)
- `docker-compose.yml` — full stack (API, worker, web, seed, infra)

## Models (change in `.env`)

All calls go through OpenRouter. Examiner turn generation and follow-ups use `OPENROUTER_SCORING_MODEL`.

| Env | Role | Default |
|---|---|---|
| `OPENROUTER_STT_MODEL` | Transcription | `openai/whisper-large-v3-turbo` |
| `OPENROUTER_STT_FALLBACK_MODEL` | STT fallback | `openai/whisper-large-v3` |
| `OPENROUTER_TTS_MODEL` | Examiner speech | `openai/gpt-4o-mini-tts` |
| `OPENROUTER_TTS_VOICE` | TTS voice | `alloy` |
| `OPENROUTER_SCORING_MODEL` | Band JSON + follow-ups | `google/gemma-3-27b-it:free` |
| `OPENROUTER_SCORING_FALLBACK_MODEL` | Scoring fallback | `google/gemma-3-27b-it` |
| `OPENROUTER_PRONUNCIATION_MODEL` | Pronunciation notes | `google/gemma-3-27b-it:free` |

`OPENROUTER_API_KEY` is required to transcribe, speak, follow up, or grade.

## Grading

Assembler owns overall band (`round_to_nearest_half`). Model JSON never writes `reports` directly.

- Transcript → grammatical_range_and_accuracy, lexical_resource, mistake quotes
- Audio (WPM, pauses, silence, clipping, word confidence) → fluency_and_coherence, pronunciation

Accent is not an error. Low coverage → pronunciation/fluency confidence low or inconclusive. Short speech → `overall_band` null.

## Audio

Examiner TTS cached in MinIO. Candidate signed PUT/GET. Derivatives: 16 kHz mono WAV.

## Out of scope

Official Cambridge papers, expert raters, Clerk, fake bands.
