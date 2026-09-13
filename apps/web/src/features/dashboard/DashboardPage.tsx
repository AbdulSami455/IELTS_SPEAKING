import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, type TestListItem } from "../../lib/api";
import {
  bandText,
  formatDateTime,
  prettyState,
  criterionLabel,
} from "../../lib/format";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { useUser } from "../auth/useUser";
import { useProgress } from "../progress/useProgress";
import { ProgressChart } from "../progress/ProgressChart";
import { ExamJourneyChart } from "../progress/ExamJourneyChart";
import { SkillBars } from "../progress/SkillBars";

function attemptLink(test: TestListItem) {
  if (test.state === "COMPLETED") return `/reports/by-test/${test.testId}`;
  if (["CREATED", "DEVICE_CHECK"].includes(test.state))
    return `/tests/${test.testId}/device-check`;
  if (["PROCESSING", "SUBMITTED", "FAILED"].includes(test.state))
    return `/tests/${test.testId}/processing`;
  if (["EXPIRED", "DELETING", "DELETED", "ABANDONED"].includes(test.state))
    return null;
  return `/tests/${test.testId}`;
}

export function DashboardPage() {
  const { user, setUser, error } = useUser();
  const navigate = useNavigate();
  const progress = useProgress();
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistoryError(null);
    api
      .listTests()
      .then((next) => {
        if (active) setTests(next);
      })
      .catch((err: Error) => {
        if (active) setHistoryError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  if (error === "AUTH_REQUIRED") return <Navigate to="/login" replace />;

  async function start() {
    setBusy(true);
    setLocalError(null);
    try {
      if (user?.consentRequired) setUser(await api.consent());
      const test = await api.createTest();
      navigate(`/tests/${test.testId}/device-check`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function removeTest(testId: string) {
    if (
      !window.confirm(
        "Delete this attempt? Its report and recordings will be removed.",
      )
    )
      return;
    setDeleting(testId);
    setLocalError(null);
    try {
      await api.deleteTest(testId);
      setTests((items) => items.filter((item) => item.testId !== testId));
      progress.refresh();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not delete attempt",
      );
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Delete your account and all practice data? This cannot be undone.",
      )
    )
      return;
    setDeleting("account");
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not delete account",
      );
    } finally {
      setDeleting(null);
    }
  }

  const data = progress.data;
  const filtered = [...tests]
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt ?? "") || 0) -
        (Date.parse(a.createdAt ?? "") || 0),
    )
    .filter((test) => filter === "all" || test.state === "COMPLETED");
  const resumable = [...tests]
    .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))
    .find((test) => !["COMPLETED", "PROCESSING", "SUBMITTED", "FAILED"].includes(test.state) && attemptLink(test));
  const resumeLink = resumable ? attemptLink(resumable) : null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 5, currentPage * 5);
  const statValue = (value: string | number) =>
    progress.loading && !data ? "…" : progress.error && !data ? "—" : value;

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="dashboard-heading row between">
          <div className="stack-sm">
            <p className="kicker">Practice overview</p>
            <h1>
              {user?.displayName
                ? `Welcome back, ${user.displayName.split(" ")[0]}.`
                : "Your speaking practice"}
            </h1>
            <p className="muted">
              Practise your speaking, review your feedback, and track your next step.
            </p>
          </div>
          <span className="date-label">
            <Icon name="clock" size={16} />
            {new Date().toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
        </section>
        {(localError || error) && (
          <Alert tone="error">{localError || error}</Alert>
        )}
        <section className="practice-hero">
          <div className="stack">
            <span className="hero-tag">IELTS SPEAKING PRACTICE</span>
            <h2>Your next conversation<br /><span>starts here.</span></h2>
            <p>Practise a full speaking test with an AI examiner. Get an estimated band, detailed feedback, and a plan for your next session.</p>
            <div className="practice-facts">
              <span><Icon name="clock" size={16} /> 11–14 minutes</span>
              <span><Icon name="mic" size={16} /> Microphone required</span>
            </div>
            <div className="row hero-actions">
              {resumeLink ? (
                <>
                  <Link className="btn btn--primary btn--lg" to={resumeLink}>Resume practice <Icon name="arrow" size={18} /></Link>
                  <Button variant="secondary" onClick={start} loading={busy} disabled={!user}>Start a new test</Button>
                </>
              ) : (
                <Button size="lg" onClick={start} loading={busy} disabled={!user}>
                  {busy ? "Preparing your test…" : "Start practice test"}<Icon name="arrow" size={18} />
                </Button>
              )}
            </div>
            <p className="hero-helper">{resumeLink ? "You have an unfinished session. Continue where you left off." : "First, we’ll help you check your microphone."}</p>
            {user?.consentRequired && (
              <p className="consent-note">
                By starting, you consent to private audio recording for scoring
                and deletion on the retention schedule.
              </p>
            )}
          </div>
          <div className="hero-visual home-orb" aria-hidden="true">
            <div className="orb-halo">
              <div className="voice-orb" />
            </div>
            <span className="orb-caption">Your speaking partner</span>
          </div>
        </section>
        {progress.error && (
          <Alert tone="error">
            Progress could not be loaded. {progress.error}{" "}
            <Button size="sm" variant="secondary" onClick={progress.refresh}>
              Retry
            </Button>
          </Alert>
        )}
        <section className="stats-grid" aria-label="Your speaking statistics">
          {[
            {
              label: "Latest test band",
              value: bandText(data?.latestBand),
              note: "Your most recent estimate",
              icon: "chart" as const,
            },
            {
              label: "Lifetime overall (all tests)",
              value: bandText(
                data?.examHistory?.lifetimeOverallBand ??
                  data?.overallEstimate ??
                  undefined,
              ),
              note: data?.examHistory?.scoredExamCount
                ? `Mean band across ${data.examHistory.scoredExamCount} scored test${data.examHistory.scoredExamCount === 1 ? "" : "s"}`
                : data?.estimateSampleSize
                  ? `Based on ${data.estimateSampleSize} recent scored test${data.estimateSampleSize === 1 ? "" : "s"}`
                  : "Available after one usable test",
              icon: "spark" as const,
            },
            {
              label: "Tests completed",
              value: data?.testsCompleted ?? 0,
              note: "Completed speaking sessions",
              icon: "check" as const,
            },
            {
              label: "Your target",
              value: bandText(data?.activeGoal?.targetBand),
              note: data?.activeGoal
                ? "Your target band estimate"
                : "Set a goal in My progress",
              icon: "target" as const,
            },
          ].map((stat) => (
            <div className="stat" key={stat.label}>
              <div className="row between">
                <span className="caption">{stat.label}</span>
                <Icon name={stat.icon} size={18} />
              </div>
              <b>{statValue(stat.value)}</b>
              <p className="caption">{stat.note}</p>
            </div>
          ))}
        </section>
        {data && (data.testsCompleted ?? 0) > 0 && !Number.isFinite(data.latestBand) && (
          <Alert tone="info">
            <strong>Your latest test has no reliable band yet.</strong> One usable test is enough; more tests are not required to unlock a score. Open the report to see what prevented scoring.
            {data.latestReportId && <Link className="text-link" to={`/reports/${data.latestReportId}`}>Review latest report <Icon name="arrow" size={16} /></Link>}
          </Alert>
        )}
        {progress.loading && !data ? (
          <div className="card loading-panel" role="status">
            Loading your progress…
          </div>
        ) : (
          data && (
            <div className="stack-lg dashboard-progress">
              {data.examHistory && (
                <ExamJourneyChart examHistory={data.examHistory} />
              )}
              <div className="dashboard-charts">
                <ProgressChart
                  timeline={data.timeline}
                  target={data.activeGoal?.targetBand}
                  compact
                />
                <SkillBars stats={data.criterionStats} />
              </div>
            </div>
          )
        )}
        {data?.weakestSkill && (
          <Link to="/progress" className="focus-banner">
            <span className="icon-tile">
              <Icon name="spark" />
            </span>
            <span>
              <strong>
                Recommended focus: {criterionLabel(data.weakestSkill)}
              </strong>
              <span className="caption">
                View targeted activities in your practice plan.
              </span>
            </span>
            <Icon name="arrow" />
          </Link>
        )}
        <section className="card stack" aria-label="Attempt history">
          <div className="row between">
            <div>
              <p className="kicker">Session history</p>
              <h2>Recent practice</h2>
            </div>
            <div className="segmented" aria-label="Filter attempts">
              {["all", "completed"].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                  aria-pressed={filter === value}
                >
                  {value === "all" ? "All attempts" : "Completed"}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="loading-panel" role="status">
              Loading your attempts…
            </div>
          ) : historyError ? (
            <Alert tone="error">
              {historyError}{" "}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRevision((n) => n + 1)}
              >
                Retry
              </Button>
            </Alert>
          ) : visible.length === 0 ? (
            <div className="empty">
              {filter === "completed"
                ? "No completed tests yet. Finish a conversation to see your report here."
                : "No practice sessions yet. Start your first test above; your saved sessions and reports will appear here."}
            </div>
          ) : (
            <div className="attempt-list">
              {visible.map((test) => {
                const link = attemptLink(test);
                const point = data?.timeline.find(
                  (p) => p.testId === test.testId,
                );
                const exam = data?.examHistory?.exams.find(
                  (e) => e.testId === test.testId,
                );
                return (
                  <div className="attempt-row" key={test.testId}>
                    <span className="attempt-icon">
                      <Icon name="message" />
                    </span>
                    <div className="stack-sm">
                      <strong>Full speaking test</strong>
                      <span className="caption">
                        {formatDateTime(test.createdAt) || "Date unavailable"}
                      </span>
                    </div>
                    <Badge
                      tone={test.state === "COMPLETED" ? "accent" : "neutral"}
                    >
                      {prettyState(test.state)}
                    </Badge>
                    <div className="attempt-scores stack-sm">
                      <strong className="attempt-band">
                        {exam?.overallBand !== undefined
                          ? `${bandText(exam.overallBand)} overall`
                          : point?.overallBand !== undefined
                            ? `${bandText(point.overallBand)} band`
                            : "—"}
                      </strong>
                      {exam && (
                        <span className="caption attempt-criteria">
                          F {bandText(exam.criteria.fluency_and_coherence)} · V{" "}
                          {bandText(exam.criteria.lexical_resource)} · G{" "}
                          {bandText(exam.criteria.grammatical_range_and_accuracy)} · P{" "}
                          {bandText(exam.criteria.pronunciation)}
                        </span>
                      )}
                    </div>
                    {link ? (
                      <Link className="text-link" to={link}>
                        {test.state === "COMPLETED"
                          ? "View report"
                          : ["PROCESSING", "SUBMITTED", "FAILED"].includes(
                                test.state,
                              )
                            ? "View status"
                            : "Continue"}
                        <Icon name="arrow" size={16} />
                      </Link>
                    ) : (
                      <span className="caption">Closed</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTest(test.testId)}
                      disabled={deleting !== null}
                      loading={deleting === test.testId}
                      aria-label={`Delete attempt from ${formatDateTime(test.createdAt)}`}
                    >
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {pageCount > 1 && (
            <div className="row between">
              <span className="caption">
                Page {currentPage} of {pageCount}
              </span>
              <div className="row">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
        <details className="account-settings no-print">
          <summary>Account & data settings</summary>
          <div className="row between">
            <p className="caption">
              Permanently remove your account, recordings, and practice history.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteAccount}
              disabled={deleting !== null}
              loading={deleting === "account"}
            >
              Delete account
            </Button>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
