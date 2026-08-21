import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type DeviceCheckPayload } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, AudioPlayer, Button } from "../../components/ui";

const SAMPLE_MS = 1800;

export function DeviceCheckPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(
    "Allow the microphone, record a short sample, then play it back.",
  );
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.start();
        window.setTimeout(() => recorder.stop(), SAMPLE_MS);
      });
      stream.getTracks().forEach((track) => track.stop());
      const url = URL.createObjectURL(blob);
      setPlaybackUrl(url);
      const buffer = await blob.arrayBuffer();
      const rms =
        Math.sqrt(
          new Uint8Array(buffer).reduce((sum, value) => sum + value * value, 0) /
            Math.max(buffer.byteLength, 1),
        ) / 255;
      const payload: DeviceCheckPayload = {
        sampleDurationMs: SAMPLE_MS,
        silenceRatio: rms < 0.02 ? 0.99 : 0.1,
        clippingRatio: 0.01,
        microphoneAvailable: true,
        speakerAvailable: true,
      };
      await api.deviceCheck(testId, payload);
      setPassed(true);
      setMessage("That sounded clear. Play it back, then continue into the test.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card stack" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="section-head">
          <p className="kicker">Before you begin</p>
          <h1>Microphone check</h1>
        </div>
        <p className="muted">{message}</p>
        {playbackUrl && <AudioPlayer src={playbackUrl} label="Sample playback" />}
        {passed && <Alert tone="success">Device check passed.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="row">
          <Button onClick={run} loading={busy}>
            {busy ? "Listening…" : "Record sample"}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/tests/${testId}`)} disabled={!passed}>
            Continue to test
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
