import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button } from "../../components/ui";

const STAGES = [
  { id: "validating_audio", label: "Checking recordings" },
  { id: "transcribing", label: "Transcribing speech" },
  { id: "analyzing_language", label: "Grammar and vocabulary" },
  { id: "analyzing_pronunciation", label: "Fluency and pronunciation" },
  { id: "building_report", label: "Building your report" },
];

export function ProcessingPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("queued");
  const [error, setError] = useState<string | null>(null);

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
          navigate(`/reports/${status.reportId}`);
          return;
        }
        if (status.stage === "failed" || status.state === "FAILED") {
          cancelled = true;
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
      <section className="card stack" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="section-head">
          <p className="kicker">After the conversation</p>
          <h1>Listening back, carefully.</h1>
        </div>
        <progress className="progress-track" value={progress} max={100} aria-label="Scoring progress" />
        <p className="caption">{progress}% complete</p>
        <ul className="stage-list">
          {STAGES.map((item, index) => {
            const done = activeIndex === -1 ? false : index < activeIndex;
            const active = index === activeIndex;
            return (
              <li key={item.id} className={done ? "done" : active ? "active" : ""}>
                <span className="stage-dot" aria-hidden="true" />
                {item.label}
                <span className="caption" style={{ marginLeft: "auto" }}>
                  {done ? "done" : active ? "now" : ""}
                </span>
              </li>
            );
          })}
        </ul>
        {error && (
          <>
            <Alert tone="error">{error}</Alert>
            <Link to="/">
              <Button variant="secondary">Back to studio</Button>
            </Link>
          </>
        )}
      </section>
    </AppShell>
  );
}
