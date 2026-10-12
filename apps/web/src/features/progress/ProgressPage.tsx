import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Info, Target } from "lucide-react";
import { api } from "../../lib/api";
import { CRITERIA } from "../../lib/criteria";
import { bandText, confidenceText, criterionLabel, formatDate, humanize } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconTile,
  LoadingState,
  Meter,
  PageHeading,
  SectionHeading,
  SelectInput,
  Skeleton,
  Stat,
  StatGrid,
  TextInput,
} from "../../components/studio";
import { ProgressChart } from "./ProgressChart";
import { ExamJourneyChart } from "./ExamJourneyChart";
import { SkillBars } from "./SkillBars";
import { useProgress } from "./useProgress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      if (!targetDate || targetDate < dateInput(new Date())) throw new Error("Choose a target date today or in the future.");
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
      await api.patchAction(id, { completed: state === "completed", skipped: state === "skipped" });
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update activity");
    } finally {
      setPendingAction(null);
    }
  }

  const actions = data?.actions ?? [];
  const doneCount = actions.filter((a) => a.completed).length;
  const gap = data?.activeGoal && data.latestBand != null ? data.activeGoal.targetBand - data.latestBand : null;
  const statsLoading = loading && !data;

  const stats = [
    { label: "Latest band", value: bandText(data?.latestBand), note: "Out of 9.0" },
    {
      label: "Practice estimate",
      value: bandText(data?.overallEstimate ?? undefined),
      note: data?.estimateSampleSize ? `Average of ${data.estimateSampleSize} recent test${data.estimateSampleSize === 1 ? "" : "s"}` : "After one usable test",
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
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeading
          kicker="Your development"
          title="My progress"
          lead="Track your band estimates, see which skills are moving, and set a goal to aim for."
          action={
            <Button to="/">
              Practise again <ArrowRight />
            </Button>
          }
        />

        {error && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" size="sm" onClick={refresh}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        <StatGrid aria-label="Progress summary" aria-busy={statsLoading}>
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} small={stat.small} value={statsLoading ? <Skeleton width={72} height={34} /> : stat.value} note={stat.note} />
          ))}
        </StatGrid>

        {statsLoading && (
          <Card>
            <LoadingState label="Loading your progress…" />
          </Card>
        )}

        {data && (
          <>
            {data.weakestSkill && (
              <div className="flex items-center gap-4 rounded-lg border border-border bg-blush px-5 py-4">
                <IconTile className="bg-card">
                  <Target className="size-5" aria-hidden="true" />
                </IconTile>
                <span className="grid min-w-0 gap-0.5">
                  <span className="kicker">Your next focus</span>
                  <strong className="text-base">{criterionLabel(data.weakestSkill)}</strong>
                  <span className="text-[13px] text-muted-foreground">Start with one practical change from your latest report, then tick it off below.</span>
                </span>
              </div>
            )}
            {data.examHistory && <ExamJourneyChart examHistory={data.examHistory} target={data.activeGoal?.targetBand} />}
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <ProgressChart timeline={data.timeline} target={data.activeGoal?.targetBand} />
              <SkillBars stats={data.criterionStats} />
            </div>
            <Collapsible className="rounded-lg border border-border bg-card px-5 py-3">
              <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 text-left text-sm font-medium text-foreground">
                <Info className="size-4 text-primary" aria-hidden="true" />
                How the practice estimate is calculated
                <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-2 pt-3 pb-2 text-sm text-subtle">
                  <p>
                    Your practice estimate averages up to five recent, conclusive tests scored with the same evaluator, rounded to the nearest half band. Individual
                    test bands stay separate in each report.
                  </p>
                  {(data.estimateSampleSize ?? 0) > 0 ? (
                    <p className="text-[13px] text-muted-foreground">
                      Based on {data.estimateSampleSize} test{data.estimateSampleSize === 1 ? "" : "s"}; observed bands {bandText(data.observedLow ?? undefined)}–
                      {bandText(data.observedHigh ?? undefined)}. More comparable tests show whether your performance is consistent — this isn’t a guarantee of exam
                      accuracy.
                    </p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      One usable test can provide your first estimate. Inconclusive tests and older scoring versions are excluded.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card id="goal" className="grid gap-5 scroll-mt-[calc(var(--topbar-h)+16px)]" aria-labelledby="goal-title">
            <SectionHeading kicker="Give yourself a destination" title={data?.activeGoal ? "Your goal" : "Set a goal"} titleId="goal-title" lead="Choose a target band, a date, and the skills you want to prioritise." />
            <form className="grid gap-5" onSubmit={saveGoal} onChange={() => setSaved(false)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Target band">
                  <SelectInput value={targetBand} onChange={(e) => setTargetBand(e.target.value)} aria-label="Target band">
                    {BAND_OPTIONS.map((band) => (
                      <option key={band}>{band}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Target date">
                  <TextInput type="date" required min={dateInput(new Date())} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="Target date" />
                </Field>
              </div>
              <fieldset className="grid gap-2.5">
                <legend className="mb-2.5 text-sm font-medium text-foreground">
                  Focus skills <span className="font-normal text-muted-foreground">(optional)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {CRITERIA.map((skill) => {
                    const checked = focusSkills.includes(skill.key);
                    return (
                      <label
                        key={skill.key}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-subtle hover:border-ring",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(e) => setFocusSkills((current) => (e.target.checked ? [...current, skill.key] : current.filter((s) => s !== skill.key)))}
                        />
                        {checked && <Check className="size-3.5" aria-hidden="true" />}
                        {skill.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <Button type="submit" loading={saving} disabled={loading || !data}>
                  {data?.activeGoal ? "Update goal" : "Save goal"}
                </Button>
              </div>
              {saveError && <Alert tone="error">{saveError}</Alert>}
              {saved && <Alert tone="success">Goal saved. Your target now shows on your charts.</Alert>}
            </form>
          </Card>

          <Card id="actions" className="grid gap-5" aria-labelledby="actions-title">
            <SectionHeading
              kicker="Put feedback into practice"
              title="Your next steps"
              titleId="actions-title"
              action={
                actions.length > 0 && (
                  <Badge tone="accent">
                    {doneCount}/{actions.length} done
                  </Badge>
                )
              }
            />
            {actions.length > 0 && <Meter value={doneCount} max={actions.length} label="Practice activities completed" />}
            <p className="text-[13px] text-muted-foreground">Activities from your reports. Ticking them off tracks practice, not your band.</p>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            {!actions.length && <EmptyState title="Nothing to practise yet">Your personalised practice activities will appear after a completed test.</EmptyState>}
            {actions.length > 0 && (
              <ul className="grid gap-3">
                {actions.map((action) => {
                  const finished = action.completed || action.skipped;
                  return (
                    <li key={action.id} className={cn("flex items-start gap-3 rounded-lg border border-border bg-background p-4", finished && "opacity-70")}>
                      <span
                        className={cn(
                          "mt-0.5 inline-grid size-6 shrink-0 place-items-center rounded-full border text-xs",
                          action.completed ? "border-success bg-success text-white" : "border-input bg-card text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {action.completed ? <Check className="size-3.5" /> : action.skipped ? "–" : ""}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-2">
                        <span className="kicker">{criterionLabel(action.category)}</span>
                        <p className={cn("text-sm text-foreground", finished && "line-through decoration-muted-foreground/60")}>{action.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {finished ? (
                            <>
                              <span className="text-[13px] text-muted-foreground">{action.completed ? "Completed" : "Skipped"}</span>
                              <Button variant="ghost" size="sm" disabled={pendingAction !== null || loading} onClick={() => updateAction(action.id, "reset")}>
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
                                <Check /> Mark done
                              </Button>
                              <Button variant="ghost" size="sm" disabled={pendingAction !== null || loading} onClick={() => updateAction(action.id, "skipped")}>
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
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
