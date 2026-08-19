import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ApiError, api, getToken, setToken, type Report, type User } from "../lib/api";
import { TestRunnerPage } from "../features/test-runner/TestRunner";
import { Layout, VolumeAudio, criterionLabel, prettyState } from "../ui";

function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!getToken()) {
      setError("AUTH_REQUIRED");
      return;
    }
    api.me().then(setUser).catch((err: ApiError) => {
      if (err.code !== "RATE_LIMITED") setError(err.message);
    });
  }, []);
  return { user, setUser, error };
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await api.register(email, password, displayName)
          : await api.login(email, password);
      setToken(result.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid">
        <div className="auth-story stack">
          <p className="kicker">Practice studio</p>
          <h1>Speak as if the examiner is already in the room.</h1>
          <p>
            A full Part 1–3 conversation: timed answers, follow-up questions, private recording, then a four-criterion
            report. Not an official IELTS result — a serious rehearsal.
          </p>
        </div>
        <div className="auth-form stack">
          <h2>{mode === "register" ? "Create your studio" : "Welcome back"}</h2>
          <form className="stack" onSubmit={submit}>
            {mode === "register" && (
              <label className="field">
                Name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </label>
            )}
            <label className="field">
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="field">
              Password (8+ characters)
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </label>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Enter studio"}
            </button>
          </form>
          <button className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { user, setUser, error } = useUser();
  const navigate = useNavigate();
  const [tests, setTests] = useState<{ testId: string; state: string; createdAt?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (error) setLocalError(error === "AUTH_REQUIRED" ? null : error);
    api.listTests().then(setTests).catch((err: ApiError) => {
      if (err.code !== "RATE_LIMITED") setLocalError(err.message);
    });
  }, [error]);

  if (error === "AUTH_REQUIRED") return <Navigate to="/login" replace />;

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

  return (
    <Layout>
      <div className="stack">
        <section className="hero">
          <div className="card stack">
            <p className="kicker">Your studio</p>
            <h1>Sit the speaking test</h1>
            <p className="muted">
              {user?.displayName ? `Hello, ${user.displayName}. ` : ""}
              A live examiner talks first. You answer out loud. We score fluency, grammar, vocabulary, and pronunciation.
            </p>
            {user?.consentRequired && (
              <p className="muted">Starting records your answers privately for scoring, then deletes them on the retention schedule.</p>
            )}
            {localError && localError !== "AUTH_REQUIRED" && <div className="error">{localError}</div>}
            <div className="row">
              <button onClick={start} disabled={busy}>
                {busy ? "Opening the room…" : "Start full test"}
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (!window.confirm("Delete this account and all practice data?")) return;
                  await api.deleteAccount();
                  setToken(null);
                  window.location.href = "/login";
                }}
              >
                Delete account
              </button>
            </div>
          </div>
          <div className="card stack">
            <p className="kicker">Format</p>
            <div className="stat">
              <b>11–14</b>
              minutes, three parts
            </div>
            <p className="muted">Part 1 interview · Part 2 cue card · Part 3 discussion with follow-ups.</p>
          </div>
        </section>
        <section className="card stack">
          <h2>History</h2>
          {tests.length === 0 && <p className="muted">No attempts yet. Your first report will land here.</p>}
          {tests.map((test) => (
            <div className="history-item" key={test.testId}>
              <span className="badge">{prettyState(test.state)}</span>
              <Link to={test.state === "COMPLETED" ? `/reports/by-test/${test.testId}` : `/tests/${test.testId}`}>
                {test.createdAt ? new Date(test.createdAt).toLocaleString() : test.testId}
              </Link>
              <button
                className="ghost"
                onClick={async () => {
                  await api.deleteTest(test.testId);
                  setTests(await api.listTests());
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
}

function DeviceCheckPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Allow the microphone, record a short sample, then play it back.");
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
        window.setTimeout(() => recorder.stop(), 1800);
      });
      stream.getTracks().forEach((track) => track.stop());
      const url = URL.createObjectURL(blob);
      setPlaybackUrl(url);
      const buffer = await blob.arrayBuffer();
      const rms =
        Math.sqrt(new Uint8Array(buffer).reduce((sum, value) => sum + value * value, 0) / Math.max(buffer.byteLength, 1)) /
        255;
      await api.deviceCheck(testId, {
        sampleDurationMs: 1800,
        silenceRatio: rms < 0.02 ? 0.99 : 0.1,
        clippingRatio: 0.01,
        microphoneAvailable: true,
        speakerAvailable: true,
      });
      setPassed(true);
      setMessage("That sounded clear. Play it back, then continue into the test.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <section className="card stack">
        <p className="kicker">Before you begin</p>
        <h1>Microphone check</h1>
        <p>{message}</p>
        {playbackUrl && <VolumeAudio src={playbackUrl} label="Sample playback" />}
        {passed && <div className="ok">Device check passed.</div>}
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button className="record" onClick={run} disabled={busy}>
            {busy ? "Listening…" : "Record sample"}
          </button>
          <button className="secondary" onClick={() => navigate(`/tests/${testId}`)} disabled={!passed}>
            Continue to test
          </button>
        </div>
      </section>
    </Layout>
  );
}

const STAGES = [
  { id: "validating_audio", label: "Checking recordings" },
  { id: "transcribing", label: "Transcribing speech" },
  { id: "analyzing_language", label: "Grammar and vocabulary" },
  { id: "analyzing_pronunciation", label: "Fluency and pronunciation" },
  { id: "building_report", label: "Building your report" },
];

function ProcessingPage() {
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

  return (
    <Layout>
      <section className="card stack">
        <p className="kicker">After the conversation</p>
        <h1>Listening back, carefully</h1>
        <progress value={progress} max={100} />
        <ul className="stage-list">
          {STAGES.map((item) => (
            <li key={item.id} className={item.id === stage ? "on" : ""}>
              {item.label}
              <span>{item.id === stage ? "now" : ""}</span>
            </li>
          ))}
        </ul>
        {error && <div className="error">{error}</div>}
      </section>
    </Layout>
  );
}

function ReportPage() {
  const { reportId, testId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (reportId) {
          setReport(await api.report(reportId));
          return;
        }
        if (testId) {
          const test = await api.getTest(testId);
          if (test.reportId) setReport(await api.report(test.reportId));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load report");
      }
    }
    void load();
  }, [reportId, testId]);

  if (error)
    return (
      <Layout>
        <div className="error">{error}</div>
      </Layout>
    );
  if (!report)
    return (
      <Layout>
        <div className="card">Opening your report…</div>
      </Layout>
    );

  return (
    <Layout>
      <div className="stack">
        <section className="card stack">
          <p className="kicker">{report.confidenceLabel} confidence</p>
          <p className="band">{report.isInconclusive ? "—" : report.overallBand?.toFixed(1)}</p>
          <p className="disclaimer">{report.disclaimer}</p>
          <div className="grid">
            {report.criteria.map((item) => (
              <div key={item.criterion} className="stat">
                <strong>{criterionLabel(item.criterion)}</strong>
                <b>{item.band.toFixed(1)}</b>
                <div className="meter">
                  <span style={{ width: `${(item.band / 9) * 100}%` }} />
                </div>
                <p className="muted">{item.confidence}</p>
              </div>
            ))}
          </div>
          <button
            className="secondary"
            onClick={async () => {
              const html = await api.exportReport(report.reportId);
              const popup = window.open("", "_blank");
              popup?.document.write(html);
            }}
          >
            Export
          </button>
        </section>
        <div className="grid">
          <section className="card">
            <h2>Strengths</h2>
            <ul className="list">
              {report.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Highest-value changes</h2>
            <ul className="list">
              {report.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        {report.mistakes && report.mistakes.length > 0 && (
          <section className="card">
            <h2>Mistakes</h2>
            <ul className="list">
              {report.mistakes.map((item, index) => (
                <li key={index}>
                  <strong>{criterionLabel(item.type ?? "issue")}</strong>
                  {item.quote && <div className="quote">“{item.quote}”</div>}
                  {item.correction && <div>Try: {item.correction}</div>}
                  {item.note && <p className="muted">{item.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {report.exampleRewrites.length > 0 && (
          <section className="card">
            <h2>Safer rewrites</h2>
            <ul className="list">
              {report.exampleRewrites.map((item, index) => (
                <li key={index}>
                  <div className="muted">{item.original}</div>
                  <div>{item.saferRewrite}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {report.fluency && report.fluency.length > 0 && (
          <section className="card">
            <h2>Fluency from the audio</h2>
            <ul className="list">
              {report.fluency.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        {report.transcripts && report.transcripts.length > 0 && (
          <section className="card stack">
            <h2>Transcripts</h2>
            {report.transcripts.map((item, index) => (
              <div key={index}>
                <span className="badge">Part {item.part}</span>
                <p className="muted">{item.promptText}</p>
                <p>{item.text}</p>
              </div>
            ))}
          </section>
        )}
        {report.pronunciation && report.pronunciation.length > 0 && (
          <section className="card">
            <h2>Pronunciation</h2>
            <p className="muted">Accent is not treated as an error.</p>
            {report.pronunciation.map((item, index) => (
              <div key={index}>
                <p>
                  Coverage {(item.coverage ?? 0).toFixed(2)} · {item.wordsPerMinute ?? 0} wpm · {item.confidence}
                </p>
                {(item.unclearWords ?? []).length > 0 && <p>Unclear words: {(item.unclearWords ?? []).join(", ")}</p>}
              </div>
            ))}
          </section>
        )}
        <section className="card">
          <h2>Seven-day practice plan</h2>
          <ul className="list">
            {report.practicePlan.days?.map((day) => (
              <li key={day.day}>
                Day {day.day}: {day.task}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
}

function ProgressPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.progress>> | null>(null);
  const [targetBand, setTargetBand] = useState("7.0");
  const [targetDate, setTargetDate] = useState("2026-12-01");

  useEffect(() => {
    api.progress().then(setData).catch(() => undefined);
  }, []);

  async function saveGoal() {
    await api.saveGoal({
      targetBand: Number(targetBand),
      targetDate: new Date(targetDate).toISOString(),
      focusSkills: ["fluency_and_coherence", "pronunciation"],
    });
    setData(await api.progress());
  }

  return (
    <Layout>
      <div className="stack">
        <section className="card stack">
          <p className="kicker">Your arc</p>
          <h1>Progress</h1>
          <div className="grid">
            <div className="stat">
              Latest band
              <b>{data?.latestBand ?? "—"}</b>
            </div>
            <div className="stat">
              Tests
              <b>{data?.testsCompleted ?? 0}</b>
            </div>
            <div className="stat">
              Trend
              <b>{(data?.overallTrend ?? "—").replaceAll("_", " ")}</b>
            </div>
          </div>
          {data?.weakestSkill && <p className="muted">Weakest skill: {criterionLabel(data.weakestSkill)}</p>}
        </section>
        {data?.criterionStats && data.criterionStats.length > 0 && (
          <section className="card stack">
            <h2>Criteria averages</h2>
            {data.criterionStats.map((item) => (
              <div key={item.criterion}>
                <div className="row between">
                  <span>{criterionLabel(item.criterion)}</span>
                  <strong>{item.averageBand ?? "—"}</strong>
                </div>
                <div className="meter">
                  <span style={{ width: `${((item.averageBand ?? 0) / 9) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        )}
        <section className="card stack">
          <h2>Goal</h2>
          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              Target band
              <input value={targetBand} onChange={(event) => setTargetBand(event.target.value)} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 160 }}>
              Date
              <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </label>
            <button onClick={saveGoal}>Save goal</button>
          </div>
        </section>
        <section className="card">
          <h2>Practice actions</h2>
          {(!data?.actions || data.actions.length === 0) && <p className="muted">Complete a test to generate a plan.</p>}
          <ul className="list">
            {data?.actions.map((action) => (
              <li key={action.id}>
                {action.description}{" "}
                <button
                  className="ghost"
                  onClick={async () => {
                    await api.patchAction(action.id, { completed: true });
                    setData(await api.progress());
                  }}
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/tests/:testId/device-check"
        element={
          <RequireAuth>
            <DeviceCheckPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tests/:testId/processing"
        element={
          <RequireAuth>
            <ProcessingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tests/:testId"
        element={
          <RequireAuth>
            <Layout>
              <TestRunnerPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/reports/:reportId"
        element={
          <RequireAuth>
            <ReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports/by-test/:testId"
        element={
          <RequireAuth>
            <ReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/progress"
        element={
          <RequireAuth>
            <ProgressPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
