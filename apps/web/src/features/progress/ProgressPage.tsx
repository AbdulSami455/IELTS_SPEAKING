import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { CRITERIA } from "../../lib/criteria";
import { bandText, confidenceText, criterionLabel, formatDate, humanize } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, Field, LoadingState, Meter, SelectInput, Skeleton } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { ProgressChart } from "./ProgressChart";
import { ExamJourneyChart } from "./ExamJourneyChart";
import { SkillBars } from "./SkillBars";
import { useProgress } from "./useProgress";

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => (i / 2).toFixed(1));

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ProgressPage() {
  const location = useLocation();
  const { data, error, loading, refresh } = useProgress();
  const [targetBand, setTargetBand] = useState("7.0");
  const [targetDate, setTargetDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return dateInput(date);
  });
  const [focusSkills, setFocusSkills] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useDocumentTitle("My progress");

  useEffect(() => {
    if (data?.activeGoal) {
      setTargetBand(data.activeGoal.targetBand.toFixed(1));
      setTargetDate(data.activeGoal.targetDate.slice(0, 10));
      setFocusSkills(data.activeGoal.focusSkills);
    }
  }, [data?.activeGoal]);

  // Deep links such as /progress#goal land once the charts above have laid out.
  const hasData = Boolean(data);
  useEffect(() => {
    if (!hasData || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hasData, location.hash]);

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      if (!targetDate || targetDate < dateInput(new Date()))
        throw new Error("Choose a target date today or in the future.");
      await api.saveGoal({
        targetBand: Number(targetBand),
        targetDate: new Date(`${targetDate}T00:00:00Z`).toISOString(),
        focusSkills,
      });
      setSaved(true);
      refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save goal");
    } finally {
      setSaving(false);
    }
  }

  async function updateAction(id: string, state: "completed" | "skipped" | "reset") {
    setPendingAction(id);
    setActionError(null);
    try {
      await api.patchAction(id, {
        completed: state === "completed",
        skipped: state === "skipped",
      });
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update activity");
    } finally {
      setPendingAction(null);
    }
  }

  const actions = data?.actions ?? [];
  const doneCount = actions.filter((a) => a.completed).length;
  const gap =
    data?.activeGoal && data.latestBand != null ? data.activeGoal.targetBand - data.latestBand : null;

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="page-heading row between">
          <div className="stack-sm">
            <p className="kicker">Your development</p>
            <h1>My progress</h1>
            <p className="muted">Track your band estimates, see which skills are moving, and set a goal to aim for.</p>
          </div>
          <Link className="btn btn--primary" to="/">
            Practise again <Icon name="arrow" size={17} />
          </Link>
        </section>

        {error && (
          <Alert
            tone="error"
            action={<Button variant="secondary" size="sm" onClick={refresh}>Retry</Button>}
          >
            {error}
          </Alert>
        )}

        <section className="stats-grid" aria-label="Progress summary" aria-busy={loading && !data}>
          {[
            {
              label: "Latest band",
              value: bandText(data?.latestBand),
              note: "Out of 9.0",
            },
            {
              label: "Practice estimate",
              value: bandText(data?.overallEstimate ?? undefined),
              note: data?.estimateSampleSize
                ? `Average of ${data.estimateSampleSize} recent test${data.estimateSampleSize === 1 ? "" : "s"}`
                : "After one usable test",
            },
            {
              label: "Trend",
              value: data ? humanize(data.overallTrend) : "—",
              note: data ? `${data.sampleSize} comparable tests · ${confidenceText(data.confidence)}` : "",
              small: true,
            },
            {
              label: "Target band",
              value: bandText(data?.activeGoal?.targetBand),
              note: data?.activeGoal
                ? gap !== null && gap > 0
                  ? `${bandText(gap)} to go · by ${formatDate(data.activeGoal.targetDate)}`
                  : `By ${formatDate(data.activeGoal.targetDate)}`
                : "Set one below",
            },
          ].map((stat) => (
            <div className="stat" key={stat.label}>
              <span className="stat-label">{stat.label}</span>
              {loading && !data ? (
                <Skeleton width={72} height={34} />
              ) : (
                <b className={stat.small ? "trend-value" : undefined}>{stat.value}</b>
              )}
              <span className="caption">{stat.note}</span>
            </div>
          ))}
        </section>

        {loading && !data && (
          <div className="card">
            <LoadingState label="Loading your progress…" />
          </div>
        )}

        {data && (
          <>
            {data.weakestSkill && (
              <div className="focus-banner">
                <span className="icon-tile">
                  <Icon name="target" />
                </span>
                <span>
                  <span className="kicker">Your next focus</span>
                  <strong>{criterionLabel(data.weakestSkill)}</strong>
                  <span className="caption">Start with one practical change from your latest report, then tick it off below.</span>
                </span>
              </div>
            )}
            {data.examHistory && <ExamJourneyChart examHistory={data.examHistory} target={data.activeGoal?.targetBand} />}
            <div className="dashboard-charts">
              <ProgressChart timeline={data.timeline} target={data.activeGoal?.targetBand} />
              <SkillBars stats={data.criterionStats} />
            </div>
            <details className="card estimate-note">
              <summary>
                <Icon name="info" size={18} /> How the practice estimate is calculated
              </summary>
              <div className="stack-sm">
                <p>
                  Your practice estimate averages up to five recent, conclusive tests scored with the same evaluator,
                  rounded to the nearest half band. Individual test bands stay separate in each report.
                </p>
                {(data.estimateSampleSize ?? 0) > 0 ? (
                  <p className="caption">
                    Based on {data.estimateSampleSize} test{data.estimateSampleSize === 1 ? "" : "s"}; observed bands{" "}
                    {bandText(data.observedLow ?? undefined)}–{bandText(data.observedHigh ?? undefined)}. More comparable
                    tests show whether your performance is consistent — this isn’t a guarantee of exam accuracy.
                  </p>
                ) : (
                  <p className="caption">
                    One usable test can provide your first estimate. Inconclusive tests and older scoring versions are excluded.
                  </p>
                )}
              </div>
            </details>
          </>
        )}

        <div className="progress-planning">
          <section id="goal" className="card stack" aria-labelledby="goal-title">
            <div>
              <p className="kicker">Give yourself a destination</p>
              <h2 id="goal-title">{data?.activeGoal ? "Your goal" : "Set a goal"}</h2>
              <p className="caption">Choose a target band, a date, and the skills you want to prioritise.</p>
            </div>
            <form className="stack" onSubmit={saveGoal} onChange={() => setSaved(false)}>
              <div className="goal-fields">
                <Field label="Target band">
                  <SelectInput value={targetBand} onChange={(e) => setTargetBand(e.target.value)}>
                    {BAND_OPTIONS.map((band) => (
                      <option key={band}>{band}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Target date">
                  <input
                    type="date"
                    required
                    min={dateInput(new Date())}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </Field>
              </div>
              <fieldset className="skill-choices">
                <legend>
                  Focus skills <span className="caption">(optional)</span>
                </legend>
                {CRITERIA.map((skill) => (
                  <label key={skill.key} className="check-chip">
                    <input
                      type="checkbox"
                      checked={focusSkills.includes(skill.key)}
                      onChange={(e) =>
                        setFocusSkills((current) =>
                          e.target.checked ? [...current, skill.key] : current.filter((s) => s !== skill.key),
                        )
                      }
                    />
                    {skill.label}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" loading={saving} disabled={loading || !data}>
                {data?.activeGoal ? "Update goal" : "Save goal"}
              </Button>
              {saveError && <Alert tone="error">{saveError}</Alert>}
              {saved && <Alert tone="success">Goal saved. Your target now shows on your charts.</Alert>}
            </form>
          </section>

          <section className="card stack" aria-labelledby="actions-title">
            <div className="row between">
              <div>
                <p className="kicker">Put feedback into practice</p>
                <h2 id="actions-title">Your next steps</h2>
              </div>
              {actions.length > 0 && (
                <Badge tone="accent">
                  {doneCount}/{actions.length} done
                </Badge>
              )}
            </div>
            {actions.length > 0 && (
              <Meter value={doneCount} max={actions.length} label="Practice activities completed" />
            )}
            <p className="caption">
              Activities from your reports. Ticking them off tracks practice, not your band.
            </p>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            {!actions.length && (
              <div className="empty">Your personalised practice activities will appear after a completed test.</div>
            )}
            <ul className="practice-actions">
              {actions.map((action) => {
                const finished = action.completed || action.skipped;
                return (
                  <li key={action.id} className={finished ? "action-finished" : ""}>
                    <span className={`action-check${action.completed ? " is-done" : ""}`} aria-hidden="true">
                      {action.completed ? <Icon name="check" size={14} /> : action.skipped ? "–" : ""}
                    </span>
                    <div className="stack-sm">
                      <span className="kicker">{criterionLabel(action.category)}</span>
                      <p>{action.description}</p>
                      <div className="row">
                        {finished ? (
                          <>
                            <span className="caption">{action.completed ? "Completed" : "Skipped"}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pendingAction !== null || loading}
                              onClick={() => updateAction(action.id, "reset")}
                            >
                              Undo
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={pendingAction !== null || loading}
                              loading={pendingAction === action.id}
                              onClick={() => updateAction(action.id, "completed")}
                            >
                              <Icon name="check" size={15} /> Mark done
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pendingAction !== null || loading}
                              onClick={() => updateAction(action.id, "skipped")}
                            >
                              Skip for now
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
