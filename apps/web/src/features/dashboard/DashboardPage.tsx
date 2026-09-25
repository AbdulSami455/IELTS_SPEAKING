import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type TestListItem } from "../../lib/api";
import { CRITERIA } from "../../lib/criteria";
import {
  attemptStatus,
  bandText,
  criterionLabel,
  formatDateTime,
} from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, EmptyState, LoadingState, Skeleton, useConfirm } from "../../components/ui";
import { Icon, type IconName } from "../../components/ui/Icon";
import { useUser } from "../auth/useUser";
import { useProgress } from "../progress/useProgress";
import { ExamJourneyChart } from "../progress/ExamJourneyChart";
import { SkillBars } from "../progress/SkillBars";

const PAGE_SIZE = 5;
const LIVE_STATES = ["READY", "PART1", "PART2_PREP", "PART2_SPEAK", "PART3", "UPLOADING"];

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

const byNewest = (a: TestListItem, b: TestListItem) =>
  (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);

const HOW_IT_WORKS: { icon: IconName; title: string; body: string }[] = [
  { icon: "mic", title: "Check your microphone", body: "A 4-second sample makes sure the examiner can hear you." },
  { icon: "message", title: "Talk through Parts 1–3", body: "About 11–14 minutes, spoken — just like the real test." },
  { icon: "chart", title: "Get your report", body: "A band estimate per criterion, corrections, and a practice plan." },
];

export function DashboardPage() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const progress = useProgress();
  const { confirm, dialog } = useConfirm();
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed">("all");
  const [page, setPage] = useState(1);
  useDocumentTitle("Overview");

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

  async function removeTest(test: TestListItem) {
    const ok = await confirm({
      title: "Delete this attempt?",
      body: `The attempt from ${formatDateTime(test.createdAt) || "this session"}, its report, and its recordings will be permanently removed.`,
      confirmLabel: "Delete attempt",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(test.testId);
    setLocalError(null);
    try {
      await api.deleteTest(test.testId);
      setTests((items) => items.filter((item) => item.testId !== test.testId));
      progress.refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not delete attempt");
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: "Delete your account?",
      body: "Your account, every recording, all reports, and your practice history will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete everything",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting("account");
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleting(null);
    }
  }

  const data = progress.data;
  const sorted = [...tests].sort(byNewest);
  const filtered = sorted.filter((test) => filter === "all" || test.state === "COMPLETED");
  const resumable = sorted.find((test) => LIVE_STATES.includes(test.state) || ["CREATED", "DEVICE_CHECK"].includes(test.state));
  const resumeLink = resumable ? attemptLink(resumable) : null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const statsLoading = progress.loading && !data;
  const scoredExams = data?.examHistory?.exams.length ?? 0;
  const isNewLearner = Boolean(data) && (data?.testsCompleted ?? 0) === 0 && scoredExams === 0;
  const firstName = user?.displayName?.split(" ")[0];

  const stats = [
    {
      label: "Latest band",
      value: bandText(data?.latestBand),
      note: data?.latestBand != null ? "Your most recent estimate" : "After your first scored test",
      icon: "chart" as const,
    },
    {
      label: "Lifetime average",
      value: bandText(data?.examHistory?.lifetimeOverallBand ?? data?.overallEstimate ?? undefined),
      note: data?.examHistory?.scoredExamCount
        ? `Across ${data.examHistory.scoredExamCount} scored test${data.examHistory.scoredExamCount === 1 ? "" : "s"}`
        : "Available after one usable test",
      icon: "spark" as const,
    },
    {
      label: "Tests completed",
      value: String(data?.testsCompleted ?? 0),
      note: "Full speaking sessions",
      icon: "check" as const,
    },
    {
      label: "Your target",
      value: bandText(data?.activeGoal?.targetBand),
      note: data?.activeGoal ? "Set in My progress" : "Set a goal in My progress",
      icon: "target" as const,
      href: data?.activeGoal ? undefined : "/progress#goal",
    },
  ];

  return (
    <AppShell>
      {dialog}
      <div className="stack-lg">
        <section className="page-heading">
          <div className="stack-sm">
            <p className="kicker">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1>{firstName ? `Welcome${isNewLearner ? "" : " back"}, ${firstName}.` : "Your speaking practice"}</h1>
            <p className="muted">Practise a full test, review your feedback, and see what to work on next.</p>
          </div>
        </section>

        {localError && <Alert tone="error">{localError}</Alert>}

        <section className="practice-hero" aria-labelledby="hero-title">
          <div className="stack">
            <span className="hero-tag">
              <Icon name="spark" size={14} /> IELTS speaking practice
            </span>
            <h2 id="hero-title">
              {resumeLink ? (
                <>
                  Pick up where
                  <br />
                  <span>you left off.</span>
                </>
              ) : (
                <>
                  Your next conversation
                  <br />
                  <span>starts here.</span>
                </>
              )}
            </h2>
            <p>
              {resumeLink
                ? "Your unfinished session is saved. Continue with the examiner, or start a fresh test."
                : "Practise a full speaking test with an AI examiner. Get an estimated band, detailed feedback, and a plan for your next session."}
            </p>
            <div className="practice-facts">
              <span><Icon name="clock" size={16} /> 11–14 minutes</span>
              <span><Icon name="mic" size={16} /> Microphone required</span>
              <span><Icon name="headphones" size={16} /> Headphones recommended</span>
            </div>
            <div className="row hero-actions">
              {resumeLink ? (
                <>
                  <Link className="btn btn--primary btn--lg" to={resumeLink}>
                    Resume practice <Icon name="arrow" size={18} />
                  </Link>
                  <Button variant="secondary" size="lg" onClick={start} loading={busy} disabled={!user}>
                    Start a new test
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={start} loading={busy} disabled={!user}>
                  {busy ? "Preparing your test…" : "Start practice test"}
                  {!busy && <Icon name="arrow" size={18} />}
                </Button>
              )}
            </div>
            {user?.consentRequired && (
              <p className="consent-note">
                By starting, you consent to private audio recording for scoring and deletion on the retention schedule.
              </p>
            )}
          </div>
          <div className="hero-visual home-orb" aria-hidden="true">
            <div className="orb-halo">
              <div className="voice-orb" />
            </div>
          </div>
        </section>

        {progress.error && (
          <Alert
            tone="error"
            title="Progress could not be loaded."
            action={<Button size="sm" variant="secondary" onClick={progress.refresh}>Retry</Button>}
          >
            {progress.error}
          </Alert>
        )}

        {isNewLearner ? (
          <section className="card stack" aria-labelledby="how-title">
            <div>
              <p className="kicker">Getting started</p>
              <h2 id="how-title">How a practice test works</h2>
            </div>
            <ol className="how-steps">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <span className="icon-tile">
                    <Icon name={step.icon} size={20} />
                  </span>
                  <span className="how-step-n">Step {index + 1}</span>
                  <strong>{step.title}</strong>
                  <p className="caption">{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="caption">Your band history, skill balance, and practice plan will appear here after your first test.</p>
          </section>
        ) : (
          <>
            <section className="stats-grid" aria-label="Your speaking statistics" aria-busy={statsLoading}>
              {stats.map((stat) => (
                <div className="stat" key={stat.label}>
                  <div className="stat-head">
                    <span className="stat-label">{stat.label}</span>
                    <Icon name={stat.icon} size={18} />
                  </div>
                  {statsLoading ? <Skeleton width={72} height={34} /> : <b>{progress.error && !data ? "—" : stat.value}</b>}
                  {stat.href ? (
                    <Link className="text-link text-link--sm" to={stat.href}>{stat.note} <Icon name="arrow" size={14} /></Link>
                  ) : (
                    <span className="caption">{stat.note}</span>
                  )}
                </div>
              ))}
            </section>

            {data && (data.testsCompleted ?? 0) > 0 && !Number.isFinite(data.latestBand) && (
              <Alert
                tone="info"
                title="Your latest test has no reliable band yet."
                action={
                  data.latestReportId && (
                    <Link className="btn btn--secondary btn--sm" to={`/reports/${data.latestReportId}`}>
                      Open report
                    </Link>
                  )
                }
              >
                One usable test is enough — more tests aren’t required to unlock a score. The report explains what prevented scoring.
              </Alert>
            )}

            {data?.weakestSkill && (
              <Link to="/progress" className="focus-banner">
                <span className="icon-tile">
                  <Icon name="target" />
                </span>
                <span>
                  <span className="kicker">Recommended focus</span>
                  <strong>{criterionLabel(data.weakestSkill)}</strong>
                  <span className="caption">Your lowest average skill. See targeted activities in your practice plan.</span>
                </span>
                <Icon name="arrow" />
              </Link>
            )}

            {statsLoading ? (
              <div className="card">
                <LoadingState label="Loading your progress…" />
              </div>
            ) : (
              data && (
                <div className="dashboard-charts">
                  {data.examHistory && (
                    <ExamJourneyChart examHistory={data.examHistory} target={data.activeGoal?.targetBand} compact />
                  )}
                  <SkillBars stats={data.criterionStats} />
                </div>
              )
            )}
          </>
        )}

        {(loading || historyError || tests.length > 0) && (
          <section className="card stack" aria-labelledby="history-title">
            <div className="row between">
              <div>
                <p className="kicker">Session history</p>
                <h2 id="history-title">Recent practice</h2>
              </div>
              <div className="segmented" role="group" aria-label="Filter attempts">
                {(["all", "completed"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilter(value);
                      setPage(1);
                    }}
                    aria-pressed={filter === value}
                  >
                    {value === "all" ? "All" : "Completed"}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <LoadingState label="Loading your attempts…" compact />
            ) : historyError ? (
              <Alert
                tone="error"
                action={<Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>Retry</Button>}
              >
                {historyError}
              </Alert>
            ) : visible.length === 0 ? (
              <EmptyState title="No completed tests yet">
                Finish a conversation to see its report here.
              </EmptyState>
            ) : (
              <ul className="attempt-list">
                {visible.map((test) => {
                  const link = attemptLink(test);
                  const status = attemptStatus(test.state);
                  const point = data?.timeline.find((p) => p.testId === test.testId);
                  const exam = data?.examHistory?.exams.find((e) => e.testId === test.testId);
                  const band = exam?.overallBand ?? point?.overallBand;
                  const when = formatDateTime(test.createdAt) || "Date unavailable";
                  return (
                    <li className="attempt-row" key={test.testId}>
                      <span className="attempt-icon" aria-hidden="true">
                        <Icon name="message" size={18} />
                      </span>
                      <div className="attempt-main">
                        <strong>Full speaking test</strong>
                        <span className="caption">{when}</span>
                      </div>
                      <div className="attempt-status">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <div className="attempt-scores">
                        {band !== undefined ? (
                          <>
                            <span className="attempt-band">
                              <strong>{bandText(band)}</strong>
                              <span className="caption">overall</span>
                            </span>
                            {exam && (
                              <span className="attempt-criteria">
                                {CRITERIA.map((item) => (
                                  <span key={item.key} className="crit-chip" title={item.label}>
                                    <i style={{ background: item.color }} aria-hidden="true" />
                                    <abbr title={item.label}>{item.abbr}</abbr>
                                    {bandText(exam.criteria[item.key])}
                                  </span>
                                ))}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="caption">No band yet</span>
                        )}
                      </div>
                      <div className="attempt-actions">
                        {link ? (
                          <Link className="btn btn--secondary btn--sm" to={link}>
                            {status.action}
                          </Link>
                        ) : (
                          <span className="caption">Closed</span>
                        )}
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() => removeTest(test)}
                          disabled={deleting !== null}
                          aria-label={`Delete attempt from ${when}`}
                          title="Delete attempt"
                        >
                          {deleting === test.testId ? <span className="btn-spinner" /> : <Icon name="trash" size={17} />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {pageCount > 1 && (
              <div className="row between pager">
                <span className="caption">
                  Page {currentPage} of {pageCount}
                </span>
                <div className="row">
                  <Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        <details className="account-settings no-print">
          <summary>
            Account &amp; data settings <Icon name="chevronDown" size={16} />
          </summary>
          <div className="account-settings-body">
            <p className="caption">Permanently remove your account, recordings, and practice history.</p>
            <Button variant="danger" size="sm" onClick={deleteAccount} disabled={deleting !== null} loading={deleting === "account"}>
              Delete account
            </Button>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
