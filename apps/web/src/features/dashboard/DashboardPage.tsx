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
  const scored =
    data?.timeline.filter((p) => Number.isFinite(p.overallBand)) ?? [];
  const best = scored.length
    ? Math.max(...scored.map((p) => p.overallBand!))
    : undefined;
  const filtered = [...tests]
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt ?? "") || 0) -
        (Date.parse(a.createdAt ?? "") || 0),
    )
    .filter((test) => filter === "all" || test.state === "COMPLETED");
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
            <p className="kicker">Your personal speaking studio</p>
            <h1>
              {user?.displayName
                ? `Welcome back, ${user.displayName.split(" ")[0]}.`
                : "Make room for your voice."}
            </h1>
            <p className="muted">
              A little practice today. A more confident you tomorrow.
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
            <span className="hero-tag">
              <span className="dot on" /> YOUR AI SPEAKING PARTNER
            </span>
            <h2>
              Find your flow.
              <br />
              <span>One conversation at a time.</span>
            </h2>
            <p>
              A real conversation. Thoughtful feedback. Practise all three parts
              of the speaking test with your AI examiner.
            </p>
            <div className="row">
              <Button size="lg" onClick={start} loading={busy} disabled={!user}>
                <Icon name="mic" size={18} />
                {busy ? "Opening your room…" : "Start speaking"}
                <Icon name="arrow" size={18} />
              </Button>
              <span className="hero-meta">11–14 min · Parts 1–3</span>
            </div>
            {user?.consentRequired && (
              <p className="consent-note">
                By starting, you consent to private audio recording for scoring
                and deletion on the retention schedule.
              </p>
            )}
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orb-halo">
              <div className="voice-orb" />
            </div>
            <span className="orb-caption">
              <i /> A space to speak freely
            </span>
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
              label: "Latest band",
              value: bandText(data?.latestBand),
              note: "Your most recent estimate",
              icon: "chart" as const,
            },
            {
              label: "Personal best",
              value: bandText(best),
              note: "Best band in your history",
              icon: "spark" as const,
            },
            {
              label: "Tests completed",
              value: data?.testsCompleted ?? 0,
              note: "Conversations that count",
              icon: "check" as const,
            },
            {
              label: "Your target",
              value: bandText(data?.activeGoal?.targetBand),
              note: data?.activeGoal
                ? "Keep moving toward your goal"
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
        {progress.loading && !data ? (
          <div className="card loading-panel" role="status">
            Loading your speaking journey…
          </div>
        ) : (
          data && (
            <div className="dashboard-charts">
              <ProgressChart
                timeline={data.timeline}
                target={data.activeGoal?.targetBand}
                compact
              />
              <SkillBars stats={data.criterionStats} />
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
                Your next small step: {criterionLabel(data.weakestSkill)}
              </strong>
              <span className="caption">
                Explore your practice plan and give this skill a little extra
                attention.
              </span>
            </span>
            <Icon name="arrow" />
          </Link>
        )}
        <section className="card stack" aria-label="Attempt history">
          <div className="row between">
            <div>
              <p className="kicker">Keep showing up</p>
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
                : "Your first conversation is the start of your story. Start speaking when you’re ready."}
            </div>
          ) : (
            <div className="attempt-list">
              {visible.map((test) => {
                const link = attemptLink(test);
                const point = data?.timeline.find(
                  (p) => p.testId === test.testId,
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
                    <strong className="attempt-band">
                      {point?.overallBand !== undefined
                        ? `${bandText(point.overallBand)} band`
                        : "—"}
                    </strong>
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
