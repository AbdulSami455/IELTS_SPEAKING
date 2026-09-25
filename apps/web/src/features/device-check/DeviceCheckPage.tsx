import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { recorderMime } from "../../lib/audio";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, AudioPlayer, Button, Spinner } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";

const SAMPLE_MS = 4000;
// Matches the silence threshold the scoring pipeline uses per frame.
const SILENT_FRAME_RMS = 0.02;
const CLIP_LEVEL = 0.98;
const SAMPLE_SENTENCE = "I usually practise my English in the evening, after work.";

type Phase = "idle" | "requesting" | "recording" | "checking" | "passed" | "failed";

function friendlyMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it from your browser’s address bar (the lock or microphone icon), then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "We couldn’t find a microphone. Plug one in or check your system sound settings, then try again.";
  if (name === "NotReadableError")
    return "Your microphone is busy in another app. Close that app (for example a video call) and try again.";
  return err instanceof Error ? err.message : "The microphone check failed. Please try again.";
}

export function DeviceCheckPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  useDocumentTitle("Microphone check");

  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => () => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  }, [playbackUrl]);

  async function run() {
    if (phase === "requesting" || phase === "recording" || phase === "checking") return;
    setError(null);
    setQuiet(false);
    setPlaybackUrl(null);
    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setError(friendlyMicError(err));
      setPhase("failed");
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const frames: number[] = [];
    let clipped = 0;
    let total = 0;
    let raf = 0;
    let released = false;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      if (released) return;
      released = true;
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    try {
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const startedAt = performance.now();
      const measure = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) {
          sum += value * value;
          if (Math.abs(value) >= CLIP_LEVEL) clipped += 1;
        }
        total += samples.length;
        const rms = Math.sqrt(sum / samples.length);
        frames.push(rms);
        setLevel(rms);
        setElapsed(Math.min(SAMPLE_MS, performance.now() - startedAt));
        raf = requestAnimationFrame(measure);
      };
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        recorder.start();
        setPhase("recording");
        raf = requestAnimationFrame(measure);
        window.setTimeout(() => recorder.stop(), SAMPLE_MS);
      });
      cleanup();
      setLevel(0);
      setPhase("checking");
      setPlaybackUrl(URL.createObjectURL(blob));

      const silenceRatio = frames.length
        ? frames.filter((value) => value < SILENT_FRAME_RMS).length / frames.length
        : 1;
      const clippingRatio = total ? clipped / total : 0;
      await api.deviceCheck(testId, {
        sampleDurationMs: SAMPLE_MS,
        silenceRatio,
        clippingRatio,
        microphoneAvailable: true,
        speakerAvailable: true,
      });
      setQuiet(silenceRatio > 0.8);
      setPhase("passed");
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : "The microphone check failed. Please try again.");
      setPhase("failed");
    }
  }

  const step = phase === "passed" ? 3 : phase === "recording" || phase === "checking" ? 2 : 1;
  const secondsLeft = Math.ceil((SAMPLE_MS - elapsed) / 1000);
  const meterLevel = Math.min(1, level * 7);

  return (
    <AppShell>
      <section className="card stack workflow-card" aria-labelledby="mic-title">
        <div className="section-head">
          <p className="kicker">Before you begin</p>
          <h1 id="mic-title">Microphone check</h1>
          <p className="muted">
            A quick 4-second recording makes sure the examiner can hear you clearly.
          </p>
        </div>

        <ol className="check-steps" aria-label="Microphone check steps">
          {["Allow microphone", "Read the sentence", "Listen back"].map((label, index) => {
            const n = index + 1;
            const state = n < step || phase === "passed" ? "done" : n === step ? "on" : "";
            return (
              <li key={label} className={state} aria-current={state === "on" ? "step" : undefined}>
                <span className="step-marker" aria-hidden="true">
                  {state === "done" ? <Icon name="check" size={14} /> : n}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        <div className={`mic-sample${phase === "recording" ? " is-recording" : ""}`}>
          <span className="kicker">Read this aloud when recording starts</span>
          <p className="mic-sentence">“{SAMPLE_SENTENCE}”</p>
          <div className="level-meter" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} className={index / 24 < meterLevel ? "on" : ""} />
            ))}
          </div>
          <div className="mic-sample-status" role="status" aria-live="polite">
            {phase === "requesting" && (
              <>
                <Spinner size={16} /> Waiting for microphone permission…
              </>
            )}
            {phase === "recording" && (
              <>
                <span className="rec-dot" aria-hidden="true" /> Recording — {secondsLeft}s left
              </>
            )}
            {phase === "checking" && (
              <>
                <Spinner size={16} /> Checking your sample…
              </>
            )}
            {(phase === "idle" || phase === "failed") && <>Your browser will ask for microphone access.</>}
            {phase === "passed" && <>Sample recorded.</>}
          </div>
          {phase === "recording" && (
            <progress className="progress-track" value={elapsed} max={SAMPLE_MS} aria-label="Recording progress" />
          )}
        </div>

        {phase === "passed" && (
          <Alert tone={quiet ? "warning" : "success"} title={quiet ? "We can hear you, but only just." : "Your microphone sounds good."}>
            {quiet
              ? "Move a little closer to the microphone or speak up during the test. Play the sample back to check."
              : "Play the sample back if you like, then continue into the test."}
          </Alert>
        )}
        {playbackUrl && phase === "passed" && <AudioPlayer src={playbackUrl} label="Your sample" />}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="row workflow-actions">
          {phase === "passed" ? (
            <>
              <Button size="lg" onClick={() => navigate(`/tests/${testId}`)}>
                Continue to the test <Icon name="arrow" size={18} />
              </Button>
              <Button variant="secondary" size="lg" onClick={run}>
                <Icon name="refresh" size={16} /> Record again
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onClick={run}
              loading={phase === "requesting" || phase === "checking"}
              disabled={phase === "recording"}
            >
              <Icon name="mic" size={18} />
              {phase === "recording" ? "Recording…" : phase === "failed" ? "Try again" : "Start 4-second check"}
            </Button>
          )}
        </div>

        <p className="caption tip">
          <Icon name="headphones" size={16} /> Headphones help: they stop the examiner’s voice from being picked up as your answer.
        </p>
      </section>
    </AppShell>
  );
}
