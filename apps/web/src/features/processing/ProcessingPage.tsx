import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Info } from "lucide-react";
import { ApiError, api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button, Card, Spinner } from "../../components/studio";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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
  const [retrying, setRetrying] = useState(false);
  const [pollKey, setPollKey] = useState(0);
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
          setError(status.error ?? "Scoring failed. Retry from this page to build your feedback report.");
          return;
        }
        setFailed(false);
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
  }, [navigate, testId, pollKey]);

  async function retryScoring() {
    setRetrying(true);
    setError(null);
    setFailed(false);
    setProgress(5);
    setStage("validating_audio");
    try {
      await api.reassessTest(testId);
      setPollKey((value) => value + 1);
    } catch (err) {
      setFailed(true);
      setError(err instanceof Error ? err.message : "Could not restart scoring.");
    } finally {
      setRetrying(false);
    }
  }

  const activeIndex = STAGES.findIndex((item) => item.id === stage);

  return (
    <AppShell>
      <Card className="mx-auto grid w-full max-w-[680px] gap-5 md:p-8" aria-labelledby="processing-title">
        <div className="grid gap-1.5">
          <p className="kicker">Results &amp; feedback</p>
          <h1 id="processing-title">{failed ? "We couldn’t finish scoring" : "Preparing your report"}</h1>
          {!failed && (
            <p className="text-muted-foreground">This usually takes a minute or two. We’ll open your report as soon as it’s ready.</p>
          )}
          {failed && (
            <p className="text-muted-foreground">
              Your recordings are saved. Retry scoring to get feedback, even if some analysis steps are limited.
            </p>
          )}
        </div>
        {!failed && (
          <div className="grid gap-2">
            <Progress
              value={progress}
              aria-label="Scoring progress"
              className="[&_[data-slot=progress-indicator]]:bg-indigo-vivid [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-border"
            />
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {activeIndex === -1 ? "Waiting to start…" : `${progress}% complete`}
            </p>
          </div>
        )}
        <ol className="grid gap-1">
          {STAGES.map((item, index) => {
            const done = activeIndex !== -1 && index < activeIndex;
            const active = !failed && index === activeIndex;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors",
                  done && "text-subtle",
                  active && "bg-indigo-soft font-medium text-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "inline-grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-primary-foreground",
                    done && "border-primary bg-primary",
                    active && "border-0",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" /> : active ? <Spinner size={16} /> : null}
                </span>
                {item.label}
                <span className="sr-only">{done ? " — done" : active ? " — in progress" : ""}</span>
              </li>
            );
          })}
        </ol>
        {error && (
          <Alert tone={failed ? "error" : "warning"} title={failed ? "Scoring interrupted" : "Having trouble checking status — still trying."}>
            {error}
          </Alert>
        )}
        {failed ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void retryScoring()} disabled={retrying}>
              {retrying ? "Restarting…" : "Retry scoring"}
            </Button>
            <Button to="/" variant="secondary">
              Back to overview
            </Button>
          </div>
        ) : (
          <p className="flex items-start gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> You can leave this page — scoring continues, and the
            report will appear under Recent practice.
          </p>
        )}
      </Card>
    </AppShell>
  );
}
