import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api, sha256, type Question, type TestSession } from "../../lib/api";
import { saveDraft } from "../../lib/drafts";
import { PartSteps, TimerRing, VolumeAudio } from "../../ui";

function partLabel(state: string): string {
  if (state === "PART1") return "Part 1 — Interview";
  if (state === "PART2_PREP") return "Part 2 — Preparation";
  if (state === "PART2_SPEAK") return "Part 2 — Long turn";
  if (state === "PART3") return "Part 3 — Discussion";
  if (state === "READY") return "Ready to begin";
  return state.replaceAll("_", " ");
}

function currentQuestion(test: TestSession): Question | undefined {
  if (test.state === "PART2_PREP") {
    return test.questions.find((item) => item.part === 2 && Boolean(item.cueCard));
  }
  if (test.state === "PART2_SPEAK") {
    return test.questions.find((item) => item.part === 2 && item.answerStatus !== "VALID" && item.answerStatus !== "READY");
  }
  if (test.state === "PART3") {
    return test.questions.find((item) => item.part === 3 && item.answerStatus !== "VALID" && item.answerStatus !== "READY");
  }
  return test.questions.find((item) => item.part === 1 && item.answerStatus !== "VALID" && item.answerStatus !== "READY");
}

function complete(test: TestSession, part: number): boolean {
  return test.questions
    .filter((item) => item.part === part)
    .every((item) => item.answerStatus === "VALID" || item.answerStatus === "READY");
}

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestSession | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(45);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examinerUrl, setExaminerUrl] = useState<string | null>(null);
  const [localPlayback, setLocalPlayback] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [serverPlayback, setServerPlayback] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const testRef = useRef<TestSession | null>(null);
  const question = test ? currentQuestion(test) : undefined;
  testRef.current = test;

  useEffect(() => {
    api.getTest(testId).then(setTest).catch((err: ApiError) => setError(err.message));
  }, [testId]);

  useEffect(() => {
    setLocalPlayback(null);
    setPendingBlob(null);
    setServerPlayback(null);
    if (!test || !question) return;
    api
      .examinerAudio(test.testId, question.id)
      .then((item) => setExaminerUrl(item.playbackUrl))
      .catch(() => setExaminerUrl(null));
  }, [test?.testId, question?.id, test, question]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (testRef.current?.state === "PART2_PREP") void finishPrep();
      else void stopRecording();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function begin() {
    if (!test) return;
    const next = await api.transition(test.testId, "READY_TO_START", test.revision);
    setTest(next);
  }

  async function startPrep() {
    if (!test) return;
    const total = test.part2PrepSeconds ?? 60;
    setTotalSeconds(total);
    setSecondsLeft(total);
  }

  async function finishPrep() {
    const session = testRef.current;
    if (!session || session.state !== "PART2_PREP") return;
    setSecondsLeft(null);
    const next = await api.transition(session.testId, "COMPLETE_PART2_PREP", session.revision);
    setTest(next);
  }

  async function startRecording() {
    if (!test || !question) return;
    setError(null);
    setLocalPlayback(null);
    setPendingBlob(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    const total = question.timingSeconds ?? 45;
    setTotalSeconds(total);
    setSecondsLeft(total);
  }

  async function afterUpload(next: TestSession) {
    if (next.state === "PART1" && complete(next, 1)) {
      next = await api.transition(next.testId, "COMPLETE_PART1", next.revision);
    } else if (next.state === "PART2_SPEAK" && complete(next, 2)) {
      next = await api.transition(next.testId, "COMPLETE_PART2_SPEAK", next.revision);
    } else if (next.state === "PART3" && complete(next, 3)) {
      next = await api.transition(next.testId, "COMPLETE_PART3", next.revision);
      const submitted = await api.submit(next.testId);
      navigate(`/tests/${submitted.testId}/processing`);
      return;
    }
    setTest(next);
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    const session = testRef.current;
    if (!recorder || !session || session.state === "PART2_PREP") return;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      if (recorder.state !== "inactive") recorder.stop();
    });
    setRecording(false);
    setSecondsLeft(null);
    setPendingBlob(blob);
    setLocalPlayback(URL.createObjectURL(blob));
  }

  async function sendAnswer() {
    const session = testRef.current;
    const current = session ? currentQuestion(session) : undefined;
    const blob = pendingBlob;
    if (!session || !current || !blob) return;
    setUploading(true);
    try {
      await saveDraft(session.testId, current.answerId, blob);
      const signed = await api.uploadUrl(session.testId, current.answerId);
      await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: blob });
      const digest = await sha256(blob);
      const next = await api.uploadComplete(session.testId, current.answerId, {
        contentSha256: digest,
        mimeType: blob.type || "audio/webm",
        sizeBytes: blob.size,
      });
      const replay = await api.answerPlayback(session.testId, current.answerId).catch(() => null);
      if (replay) setServerPlayback(replay.playbackUrl);
      await afterUpload(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!test) {
    return <section className="card">{error ?? "Preparing the room…"}</section>;
  }

  if (test.state === "READY") {
    return (
      <section className="card stack">
        <p className="kicker">Speaking studio</p>
        <h1>A full IELTS-style conversation</h1>
        <PartSteps state={test.state} />
        <p>Part 1 is a short interview. Part 2 gives you a minute to think, then a long turn. Part 3 is a discussion — the examiner may follow up on what you said.</p>
        <p className="muted">Speak in English. This is practice coaching, not an official exam.</p>
        {error && <div className="error">{error}</div>}
        <button onClick={begin}>Begin Part 1</button>
      </section>
    );
  }

  if (test.state === "PART2_PREP" && question) {
    return (
      <section className="card stack">
        <div className="row between">
          <span className="badge">{partLabel(test.state)}</span>
        </div>
        <PartSteps state={test.state} />
        <p className="muted">One minute to prepare. You may not record yet. Notes are allowed.</p>
        <p className="prompt">{question.promptText}</p>
        {question.cueCard && (
          <div className="cue">
            <strong>{question.cueCard.title}</strong>
            <ul className="list">
              {question.cueCard.prompts?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {secondsLeft !== null ? <TimerRing seconds={secondsLeft} total={totalSeconds} /> : null}
        <div className="row">
          {secondsLeft === null && <button onClick={startPrep}>Start one-minute preparation</button>}
          {secondsLeft !== null && (
            <button className="secondary" onClick={finishPrep}>
              I’m ready to speak
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!question) {
    return <section className="card">{error ?? "Loading the next question…"}</section>;
  }

  const answered = test.questions.filter((item) => item.answerStatus === "VALID" || item.answerStatus === "READY").length;

  return (
    <section className="card stack">
      <div className="row between">
        <div className="row">
          <span className="badge">{partLabel(test.state)}</span>
          {question.isFollowUp && <span className="badge follow">Follow-up</span>}
        </div>
        <span className="muted">
          {answered} / {test.questions.length} answered
        </span>
      </div>
      <PartSteps state={test.state} />
      <p className="prompt">{question.promptText}</p>
      {examinerUrl && <VolumeAudio src={examinerUrl} label="Examiner" />}
      {question.cueCard && test.state === "PART2_SPEAK" && (
        <div className="cue">
          <strong>{question.cueCard.title}</strong>
          <ul className="list">
            {question.cueCard.prompts?.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {secondsLeft !== null && <TimerRing seconds={secondsLeft} total={totalSeconds} />}
      {recording && (
        <p className="live">
          <span className="pulse" /> Recording
        </p>
      )}
      {localPlayback && <VolumeAudio src={localPlayback} label="Your take — listen before sending" />}
      {serverPlayback && <VolumeAudio src={serverPlayback} label="Uploaded answer" />}
      {uploading && <p className="muted">The examiner is listening and may ask a follow-up…</p>}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="record" onClick={startRecording} disabled={recording || uploading}>
          {recording ? "Speaking…" : "Start speaking"}
        </button>
        <button className="secondary" onClick={stopRecording} disabled={!recording}>
          Stop
        </button>
        <button onClick={sendAnswer} disabled={!pendingBlob || recording || uploading}>
          Send to examiner
        </button>
      </div>
    </section>
  );
}
