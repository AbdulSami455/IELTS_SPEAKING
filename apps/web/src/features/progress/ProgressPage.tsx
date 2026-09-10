import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  bandText,
  criterionLabel,
  formatDate,
  humanize,
} from "../../lib/format";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, Field, SelectInput } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { ProgressChart } from "./ProgressChart";
import { SkillBars } from "./SkillBars";
import { useProgress } from "./useProgress";

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => (i / 2).toFixed(1));
const SKILLS = [
  "fluency_and_coherence",
  "lexical_resource",
  "grammatical_range_and_accuracy",
  "pronunciation",
];
function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ProgressPage() {
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

  useEffect(() => {
    if (data?.activeGoal) {
      setTargetBand(data.activeGoal.targetBand.toFixed(1));
      setTargetDate(data.activeGoal.targetDate.slice(0, 10));
      setFocusSkills(data.activeGoal.focusSkills);
    }
  }, [data?.activeGoal]);

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

  async function updateAction(
    id: string,
    state: "completed" | "skipped" | "reset",
  ) {
    setPendingAction(id);
    setActionError(null);
    try {
      await api.patchAction(id, {
        completed: state === "completed",
        skipped: state === "skipped",
      });
      refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not update activity",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="page-heading row between">
          <div className="stack-sm">
            <p className="kicker">Your development</p>
            <h1>My progress</h1>
            <p className="muted">
              Track your band estimates and set a focused practice goal.
            </p>
          </div>
          <Link className="btn btn--primary" to="/">
            Practise again <Icon name="arrow" size={17} />
          </Link>
        </section>
        {data && (
          <section className="card stack" aria-label="Overall practice estimate">
            <div className="row between"><div><p className="kicker">Across your recent tests</p><h2>Overall practice estimate: {bandText(data.overallEstimate ?? undefined)}</h2></div><Badge>{data.scoredTests ?? 0} scored tests</Badge></div>
            <p className="muted">Average of up to five recent, conclusive tests scored with the same evaluator, rounded to the nearest half band. Your individual test bands stay separate.</p>
            {(data.estimateSampleSize ?? 0) > 0 ? <p className="caption">Based on {data.estimateSampleSize} test(s). Observed bands: {bandText(data.observedLow ?? undefined)}–{bandText(data.observedHigh ?? undefined)}. More comparable tests show whether your performance is consistent; this is not a guarantee of exam accuracy.</p> : <p className="caption">One usable test can provide your first estimate. Inconclusive and older scoring versions are excluded.</p>}
          </section>
        )}
        {error && (
          <Alert tone="error">
            {error}{" "}
            <Button variant="secondary" size="sm" onClick={refresh}>
              Retry
            </Button>
          </Alert>
        )}
        {loading && !data && (
          <div className="card loading-panel" role="status">
            Loading your progress…
          </div>
        )}
        {data && (
          <>
            <section className="stats-grid" aria-label="Progress summary">
              <div className="stat">
                <span className="caption">Latest estimated band</span>
                <b>{bandText(data.latestBand)}</b>
                <span className="caption">Out of 9.0</span>
              </div>
              <div className="stat">
                <span className="caption">Tests completed</span>
                <b>{data.testsCompleted ?? 0}</b>
                <span className="caption">Time invested in your voice</span>
              </div>
              <div className="stat">
                <span className="caption">Overall trend</span>
                <b className="trend-value">{humanize(data.overallTrend)}</b>
                <span className="caption">
                  {data.sampleSize} comparable attempts · {data.confidence}{" "}
                  confidence
                </span>
              </div>
              <div className="stat">
                <span className="caption">Target band</span>
                <b>{bandText(data.activeGoal?.targetBand)}</b>
                <span className="caption">
                  {data.activeGoal
                    ? `By ${formatDate(data.activeGoal.targetDate)}`
                    : "Give your practice a direction"}
                </span>
              </div>
            </section>
            <div className="dashboard-charts">
              <ProgressChart
                timeline={data.timeline}
                target={data.activeGoal?.targetBand}
              />
              <SkillBars stats={data.criterionStats} />
            </div>
            {data.weakestSkill && (
              <div className="focus-banner">
                <span className="icon-tile">
                  <Icon name="target" />
                </span>
                <span>
                  <strong>
                    Your next focus: {criterionLabel(data.weakestSkill)}
                  </strong>
                  <span className="caption">
                    Start with one practical change from your latest report.
                  </span>
                </span>
              </div>
            )}
          </>
        )}
        <div className="progress-planning">
          <section className="card stack" aria-label="Speaking goal">
            <div>
              <p className="kicker">Give yourself a destination</p>
              <h2>Make it your goal</h2>
            </div>
            <p className="caption">
              Choose your target and the skills you want to work on.
            </p>
            <form
              className="stack"
              onSubmit={saveGoal}
              onChange={() => setSaved(false)}
            >
              <div className="goal-fields">
                <Field label="Target band">
                  <SelectInput
                    value={targetBand}
                    onChange={(e) => setTargetBand(e.target.value)}
                  >
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
                {SKILLS.map((skill) => (
                  <label key={skill}>
                    <input
                      type="checkbox"
                      checked={focusSkills.includes(skill)}
                      onChange={(e) =>
                        setFocusSkills((current) =>
                          e.target.checked
                            ? [...current, skill]
                            : current.filter((s) => s !== skill),
                        )
                      }
                    />
                    {criterionLabel(skill)}
                  </label>
                ))}
              </fieldset>
              <Button
                type="submit"
                loading={saving}
                disabled={loading || !data}
              >
                Save my goal <Icon name="arrow" size={16} />
              </Button>
              {saveError && <Alert tone="error">{saveError}</Alert>}
              {saved && (
                <div role="status">
                  <Alert tone="success">
                    Your goal is saved. Let’s work toward it.
                  </Alert>
                </div>
              )}
            </form>
          </section>
          <section className="card stack" aria-label="Practice actions">
            <div className="row between">
              <div>
                <p className="kicker">Put feedback into practice</p>
                <h2>Your next steps</h2>
              </div>
              {data && (
                <Badge tone="accent">
                  {data.actions.filter((a) => a.completed).length}/
                  {data.actions.length} done
                </Badge>
              )}
            </div>
            <p className="caption">
              Activities from your report. Completion is tracked separately from
              skill improvement.
            </p>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            {!data?.actions.length && (
              <div className="empty">
                Your personalised practice plan will appear after a completed
                test.
              </div>
            )}
            <ul className="practice-actions">
              {data?.actions.map((action) => (
                <li
                  key={action.id}
                  className={
                    action.completed || action.skipped ? "action-finished" : ""
                  }
                >
                  <span className="action-check" aria-hidden="true">
                    {action.completed ? "✓" : action.skipped ? "–" : ""}
                  </span>
                  <div className="stack-sm">
                    <span className="kicker">{humanize(action.category)}</span>
                    <p>{action.description}</p>
                    <div className="row">
                      {action.completed || action.skipped ? (
                        <>
                          <span className="caption">
                            {action.completed ? "Completed" : "Skipped"}
                          </span>
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
                            Mark done
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
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
