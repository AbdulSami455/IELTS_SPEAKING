import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GoalInput, type ProgressOverview } from "../../lib/api";
import { bandText, criterionLabel, formatDate, humanize } from "../../lib/format";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, Field, Meter, SelectInput } from "../../components/ui";

const BAND_OPTIONS = ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"];

export function ProgressPage() {
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [targetBand, setTargetBand] = useState("7.0");
  const [targetDate, setTargetDate] = useState("2026-12-01");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .progress()
      .then((next) => {
        setData(next);
        if (next.activeGoal) {
          setTargetBand(next.activeGoal.targetBand.toFixed(1));
          setTargetDate(next.activeGoal.targetDate.slice(0, 10));
        }
      })
      .catch(() => undefined);
  }, []);

  async function refresh() {
    setData(await api.progress());
  }

  async function saveGoal() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: GoalInput = {
        targetBand: Number(targetBand),
        targetDate: new Date(targetDate).toISOString(),
        focusSkills: ["fluency_and_coherence", "pronunciation"],
      };
      await api.saveGoal(payload);
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save goal");
    } finally {
      setSaving(false);
    }
  }

  async function completeAction(id: string) {
    await api.patchAction(id, { completed: true });
    await refresh();
  }

  async function skipAction(id: string) {
    await api.patchAction(id, { skipped: true });
    await refresh();
  }

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="page-head">
          <p className="kicker">Your arc</p>
          <h1>Progress.</h1>
          <p className="lede">
            Trends compare your latest attempts against rolling history. Estimates only — never a promise of a
            future score.
          </p>
        </section>

        <section className="grid" aria-label="Progress summary">
          <div className="stat">
            <span className="caption">Latest band</span>
            <b>{bandText(data?.latestBand)}</b>
          </div>
          <div className="stat">
            <span className="caption">Tests completed</span>
            <b>{data?.testsCompleted ?? 0}</b>
          </div>
          <div className="stat">
            <span className="caption">Trend</span>
            <b>{data ? humanize(data.overallTrend) : "—"}</b>
            <p className="muted">
              {data?.sampleSize ?? 0} comparable attempt{(data?.sampleSize ?? 0) === 1 ? "" : "s"} ·{" "}
              {data?.confidence ?? "—"} confidence
            </p>
          </div>
        </section>

        {data?.weakestSkill && (
          <Alert tone="info">
            Weakest skill right now: <strong>{criterionLabel(data.weakestSkill)}</strong>
          </Alert>
        )}

        {data?.criterionStats && data.criterionStats.length > 0 && (
          <section className="card stack" aria-label="Criteria averages">
            <div className="section-head">
              <h2>Criteria averages</h2>
              <p className="caption">Across your comparable attempts.</p>
            </div>
            {data.criterionStats.map((item) => (
              <div key={item.criterion} className="stack-sm">
                <div className="row between">
                  <span>{criterionLabel(item.criterion)}</span>
                  <strong>{bandText(item.averageBand)}</strong>
                </div>
                <Meter value={item.averageBand ?? 0} label={criterionLabel(item.criterion)} />
                <span className="caption">{item.samples} sample{item.samples === 1 ? "" : "s"}</span>
              </div>
            ))}
          </section>
        )}

        <section className="card stack" aria-label="Goal">
          <div className="section-head">
            <h2>Goal</h2>
            <p className="caption">One active goal at a time.</p>
          </div>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <Field label="Target band">
              <SelectInput value={targetBand} onChange={(event) => setTargetBand(event.target.value)}>
                {BAND_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Target date">
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </Field>
            <Button onClick={saveGoal} loading={saving}>
              Save goal
            </Button>
          </div>
          {saveError && <Alert tone="error">{saveError}</Alert>}
        </section>

        <section className="card stack" aria-label="Practice actions">
          <div className="section-head">
            <h2>Practice actions</h2>
            <p className="caption">From your latest report. Completing activities is tracked separately from skill change.</p>
          </div>
          {(!data?.actions || data.actions.length === 0) && (
            <div className="empty">Complete a test to generate a plan.</div>
          )}
          <ul className="list list--neutral">
            {data?.actions.map((action) => (
              <li key={action.id} className="row between">
                <span style={{ opacity: action.completed || action.skipped ? 0.55 : 1 }}>
                  {action.completed ? "✓ " : action.skipped ? "— " : ""}
                  {action.description}
                </span>
                {!action.completed && !action.skipped && (
                  <span className="row" style={{ gap: 6 }}>
                    <Button variant="secondary" size="sm" onClick={() => completeAction(action.id)}>
                      Done
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => skipAction(action.id)}>
                      Skip
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {data?.timeline && data.timeline.length > 0 && (
          <section className="card stack" aria-label="Recent reports">
            <div className="section-head">
              <h2>Recent reports</h2>
            </div>
            {data.timeline.map((point) => (
              <div className="history-row" key={point.testId}>
                <Badge tone="accent">Band {bandText(point.overallBand)}</Badge>
                <Link to={`/reports/${point.reportId}`}>{formatDate(point.date)}</Link>
                <span className="history-date">{formatDate(point.date)}</span>
                <span />
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
