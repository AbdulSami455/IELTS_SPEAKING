import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api, type TestListItem } from "../../lib/api";
import { formatDateTime, prettyState } from "../../lib/format";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button } from "../../components/ui";
import { useUser } from "../auth/useUser";

export function DashboardPage() {
  const { user, setUser, error } = useUser();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (error) setLocalError(error === "AUTH_REQUIRED" ? null : error);
    api
      .listTests()
      .then(setTests)
      .catch((err: ApiError) => {
        if (err.code !== "RATE_LIMITED") setLocalError(err.message);
      });
  }, [error]);

  if (error === "AUTH_REQUIRED") {
    navigate("/login", { replace: true });
    return null;
  }

  async function start() {
    setBusy(true);
    try {
      if (user?.consentRequired) {
        const next = await api.consent();
        setUser(next);
      }
      const test = await api.createTest();
      navigate(`/tests/${test.testId}/device-check`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function removeTest(testId: string) {
    if (!window.confirm("Delete this attempt? Its report and recordings will be removed.")) return;
    await api.deleteTest(testId);
    setTests(await api.listTests());
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account and all practice data? This cannot be undone.")) return;
    await api.deleteAccount();
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="page-head">
          <p className="kicker">Your studio</p>
          <h1>Sit the speaking test.</h1>
          <p className="lede">
            {user?.displayName ? `Hello, ${user.displayName}. ` : ""}A live examiner talks first. You answer out
            loud. We score fluency, grammar, vocabulary, and pronunciation.
          </p>
          {user?.consentRequired && (
            <p className="muted">
              Starting records your answers privately for scoring, then deletes them on the retention schedule.
            </p>
          )}
          {localError && <Alert tone="error">{localError}</Alert>}
          <div className="row">
            <Button size="lg" onClick={start} loading={busy}>
              {busy ? "Opening the room…" : "Start full test"}
            </Button>
          </div>
        </section>

        <section className="grid" aria-label="Test format">
          <div className="stat">
            <span className="caption">Duration</span>
            <b>11–14 min</b>
            <p className="muted">Three parts, one sitting.</p>
          </div>
          <div className="stat">
            <span className="caption">Format</span>
            <b>Parts 1–3</b>
            <p className="muted">Interview · cue card · discussion.</p>
          </div>
          <div className="stat">
            <span className="caption">Report</span>
            <b>4 criteria</b>
            <p className="muted">Estimated bands with evidence.</p>
          </div>
        </section>

        <section className="card stack" aria-label="Attempt history">
          <div className="section-head">
            <h2>History</h2>
            <p className="caption">Every attempt and its estimated report.</p>
          </div>
          {tests.length === 0 && <div className="empty">No attempts yet. Your first report will land here.</div>}
          {tests.map((test) => (
            <div className="history-row" key={test.testId}>
              <Badge tone={test.state === "COMPLETED" ? "accent" : "neutral"}>{prettyState(test.state)}</Badge>
              <Link
                to={test.state === "COMPLETED" ? `/reports/by-test/${test.testId}` : `/tests/${test.testId}`}
              >
                {test.createdAt ? formatDateTime(test.createdAt) : test.testId}
              </Link>
              <span className="history-date">{prettyState(test.state)}</span>
              <Button variant="ghost" size="sm" onClick={() => removeTest(test.testId)}>
                Delete
              </Button>
            </div>
          ))}
          <hr className="divider" />
          <div className="row between no-print">
            <span className="caption">Account actions are permanent.</span>
            <Button variant="danger" size="sm" onClick={deleteAccount}>
              Delete account
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
