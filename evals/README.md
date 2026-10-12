# AI evals

Three checks keep the model-facing parts of the product honest. None of them is a
unit test of application code; they measure the behaviour of the prompts and the
providers behind them.

| Suite | What it measures | Command |
| --- | --- | --- |
| Scoring | Band estimates on a golden set of transcripts stay inside expected ranges, prompt-injection transcripts do not move the band, output is schema-valid | `uv run python evals/scoring/run.py --live` |
| Examiner | Generated questions are single, on-topic, non-repeating, never echo candidate speech, and ignore injected instructions | `uv run python evals/examiner/run.py --live` |
| Providers | Speech-to-text transcribes a known clip within a word-error budget, text-to-speech returns playable audio, both within latency budgets | `uv run python -m ielts_inference.probes` |

`make evals` runs all three. They need `OPENROUTER_API_KEY` and spend a few cents per run.

## Record and replay

Live runs write the provider responses to `evals/scoring/recordings/<case>.json` and
`evals/examiner/recordings/<case>.json`. `--replay` re-scores those recordings without
network access, which is what `pytest evals/tests` does in CI: it checks the recorded
behaviour against `evals/thresholds.toml`, so a prompt change that silently moves a
band or lets an injection through fails the build once someone re-records.

Re-record after changing a prompt, a model, or a threshold:

```sh
uv run python evals/scoring/run.py --live --record
uv run python evals/examiner/run.py --live --record
```

Recordings are committed. Drift between a live run and the last recording is reported
(`max_drift`) and gated by `thresholds.toml`.

## Adding a scoring case

Drop a JSON file in `evals/scoring/golden/`. Fields:

- `id`, `description`
- `expected_band`: `[low, high]` inclusive, in half bands; `null` when the case should be
  inconclusive (empty or unusable transcript)
- `injection`: `true` when the transcript contains instructions aimed at the model; the
  runner additionally asserts the band stays inside `expected_band` and no criterion is
  awarded 9.0
- `mean_coverage`, `merged_features`, `conversation_context`, `parts`: the same shapes
  `evaluation.evaluate_test` passes to the scoring prompt

## Production probes

`ielts_inference.probes.run_provider_probes` is also scheduled by Celery beat every
30 minutes (`probe_providers`). Results land in Redis under `probes:providers`, are
exposed at `GET /health/providers` (bearer `METRICS_TOKEN`), and set the Prometheus
gauges `provider_probe_ok{provider}` and `provider_probe_latency_seconds{provider}`.
A failing probe logs at ERROR and, when `ALERT_WEBHOOK_URL` is set, posts a JSON alert.
