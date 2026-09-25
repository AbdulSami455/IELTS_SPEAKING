import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Spinner } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";

const STAGES = [
  { id: "validating_audio", label: "Checking recordings" },
  { id: "transcribing", label: "Transcribing your speech" },
  { id: "analyzing_language", label: "Analysing grammar and vocabulary" },
  { id: "analyzing_pronunciation", label: "Analysing fluency and pronunciation" },
  { id: "building_report", label: "Building your report" },
];

export function ProcessingPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("queued");
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useDocumentTitle(failed ? "Scoring failed" : "Preparing your report");

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let delay = 2500;

    async function poll() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const status = await api.status(testId);
        if (cancelled) return;
        delay = 2500;
        setError(null);
        setProgress(status.progress);
        setStage(status.stage);
        if (status.reportId) {
          cancelled = true;
          navigate(`/reports/${status.reportId}`, { replace: true });
          return;
        }
        if (status.stage === "failed" || status.state === "FAILED") {
          cancelled = true;
          setFailed(true);
          setError(status.error ?? "Scoring failed. No band was invented.");
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "RATE_LIMITED") {
          delay = Math.min(delay * 2, 12000);
        } else if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        inFlight = false;
        if (!cancelled) {
          window.setTimeout(() => void poll(), delay);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [navigate, testId]);

  const activeIndex = STAGES.findIndex((item) => item.id === stage);

  return (
    <AppShell>
      <section className="card stack workflow-card" aria-labelledby="processing-title">
        <div className="section-head">
          <p className="kicker">Results &amp; feedback</p>
          <h1 id="processing-title">{failed ? "We couldn’t score this test" : "Preparing your report"}</h1>
          {!failed && (
            <p className="muted">This usually takes a minute or two. We’ll open your report as soon as it’s ready.</p>
          )}
        </div>
        {!failed && (
          <div className="stack-sm">
            <progress className="progress-track" value={progress} max={100} aria-label="Scoring progress" />
            <p className="caption" aria-live="polite">
              {activeIndex === -1 ? "Waiting to start…" : `${progress}% complete`}
            </p>
          </div>
        )}
        <ol className="stage-list">
          {STAGES.map((item, index) => {
            const done = failed ? index < activeIndex : activeIndex !== -1 && index < activeIndex;
            const active = !failed && index === activeIndex;
            return (
              <li key={item.id} className={done ? "done" : active ? "active" : ""} aria-current={active ? "step" : undefined}>
                <span className="stage-marker" aria-hidden="true">
                  {done ? <Icon name="check" size={14} /> : active ? <Spinner size={14} /> : null}
                </span>
                {item.label}
                <span className="visually-hidden">{done ? " — done" : active ? " — in progress" : ""}</span>
              </li>
            );
          })}
        </ol>
        {error && (
          <Alert tone={failed ? "error" : "warning"} title={failed ? "Scoring failed" : "Having trouble checking status — still trying."}>
            {error}
          </Alert>
        )}
        {failed ? (
          <div className="row workflow-actions">
            <Link to="/" className="btn btn--primary">
              Back to overview
            </Link>
          </div>
        ) : (
          <p className="caption tip">
            <Icon name="info" size={16} /> You can leave this page — scoring continues, and the report will appear under Recent practice.
          </p>
        )}
      </section>
    </AppShell>
  );
}
