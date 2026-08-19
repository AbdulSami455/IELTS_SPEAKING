import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api, type TestSession, type Turn } from "../../lib/api";
import { PartSteps, TimerRing } from "../../ui";

const SPEECH_START_RMS = 0.05;
const SPEECH_HOLD_RMS = 0.028;
const MIN_VOICED_MS = 2200;
const NOISE_BLIP_MS = 400;
const MIN_BLOB_BYTES = 2500;
const BARGE_IN_MS = 280;

function silenceBudget(state: string): number {
  if (state === "PART2_SPEAK") return 6000;
  if (state === "PART3") return 4500;
  return 3800;
}

function partLabel(state: string): string {
  if (state === "PART1") return "Part 1 - Interview";
  if (state === "PART2_PREP") return "Part 2 - Preparation";
  if (state === "PART2_SPEAK") return "Part 2 - Long turn";
  if (state === "PART3") return "Part 3 - Discussion";
  if (state === "UPLOADING") return "Ready to finish";
  if (state === "READY") return "Ready to begin";
  return state.replaceAll("_", " ");
}

function currentTurn(test: TestSession): Turn | undefined {
  if (test.currentTurn) return test.currentTurn;
  return test.turns.find((item) => item.answerStatus !== "VALID" && item.answerStatus !== "READY");
}

function canSpeak(state: string): boolean {
  return state === "PART1" || state === "PART2_SPEAK" || state === "PART3";
}

function roomCopy(args: {
  state: string;
  examinerSpeaking: boolean;
  recording: boolean;
  busy: boolean;
  listening: boolean;
  micPaused: boolean;
}): { mode: string; kicker: string; title: string; hint: string } {
  if (args.state === "PART2_PREP") {
    return {
      mode: "prep",
      kicker: "Part 2",
      title: "Prepare silently",
      hint: "The examiner has given the cue. Use the minute to think. Do not start speaking yet.",
    };
  }
  if (args.examinerSpeaking) {
    return {
      mode: "listen",
      kicker: "Now",
      title: "Listen",
      hint: "The examiner is speaking. You can start answering as soon as you understand — that stops the question.",
    };
  }
  if (args.busy) {
    return {
      mode: "think",
      kicker: "Now",
      title: "One moment",
      hint: "The examiner is moving to the next question.",
    };
  }
  if (args.recording) {
    return {
      mode: "speak",
      kicker: "Now",
      title: "Speaking",
      hint: "We can hear you. Take a breath or think — a short pause is fine. We send the turn after a longer silence.",
    };
  }
  if (args.micPaused) {
    return {
      mode: "wait",
      kicker: "Mic paused",
      title: "Resume when ready",
      hint: "The room is not listening until you resume.",
    };
  }
  if (args.listening) {
    return {
      mode: "speak",
      kicker: "Your turn",
      title: "Speak",
      hint: "The examiner has finished. Start when you are ready. Thinking pauses during your answer are fine.",
    };
  }
  return {
    mode: "wait",
    kicker: "Room",
    title: "Getting ready",
    hint: "The microphone is opening.",
  };
}

function recorderMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

function rmsFromAnalyser(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let total = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    total += value * value;
  }
  return Math.sqrt(total / samples.length);
}

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestSession | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "live" | "offline">("idle");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(45);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const [examinerSpeaking, setExaminerSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micPaused, setMicPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examinerUrl, setExaminerUrl] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const lastMeterAtRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testRef = useRef<TestSession | null>(null);
  const recordingRef = useRef(false);
  const busyRef = useRef(false);
  const examinerSpeakingRef = useRef(false);
  const micPausedRef = useRef(false);
  const submittingRef = useRef(false);
  const startingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const speechStartedAtRef = useRef(0);
  const voicedMsRef = useRef(0);
  const lastTickAtRef = useRef(0);
  const bargeMsRef = useRef(0);
  const turn = test ? currentTurn(test) : undefined;
  testRef.current = test;
  recordingRef.current = recording;
  busyRef.current = busy;
  examinerSpeakingRef.current = examinerSpeaking;
  micPausedRef.current = micPaused;

  useEffect(() => {
    api.getTest(testId).then(setTest).catch((err: ApiError) => setError(err.message));
  }, [testId]);

  useEffect(() => {
    return () => {
      stopVad();
      socketRef.current?.close();
      streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (testRef.current?.state === "PART2_PREP") void finishPrep();
      else if (recordingRef.current) void finishUtterance();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (!examinerUrl || !audioRef.current) return;
    audioRef.current.src = examinerUrl;
    void audioRef.current.play().catch(() => undefined);
  }, [examinerUrl]);

  useEffect(() => {
    const session = test;
    if (!session || !canSpeak(session.state) || micPaused) {
      setListening(false);
      return;
    }
    void startVad();
  }, [test?.state, test?.testId, micPaused]);

  async function beginLiveRoom() {
    if (!test) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api.createRealtimeSession(test.testId);
      setTest(session.test);
      setExaminerUrl(session.examinerPlaybackUrl ?? null);
      connectSocket(api.realtimeSocketUrl(test.testId));
      await startVad();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start live room");
    } finally {
      setBusy(false);
    }
  }

  function connectSocket(url: string) {
    socketRef.current?.close();
    setConnection("connecting");
    const socket = new WebSocket(url);
    socketRef.current = socket;
    socket.onopen = () => setConnection("live");
    socket.onerror = () => setConnection("offline");
    socket.onclose = () => setConnection("offline");
  }

  async function postRealtimeEvent(
    eventType: string,
    speakerRole: "system" | "examiner" | "candidate",
    extras: Record<string, unknown> = {},
  ) {
    try {
      const payload = { eventType, speakerRole, ...extras };
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
        return;
      }
      await api.realtimeEvent(testId, payload);
    } catch {
      // Best-effort live telemetry.
    }
  }

  async function startPrep() {
    if (!test) return;
    await postRealtimeEvent("part2_prep_started", "system");
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
    await postRealtimeEvent("part2_prep_completed", "system");
    await startVad();
  }

  async function ensureStream() {
    if (streamRef.current) return streamRef.current;
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return streamRef.current;
  }

  async function startVad() {
    const stream = await ensureStream();
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    setListening(true);
    if (rafRef.current !== null) return;
    const tick = () => {
      const analyser = analyserRef.current;
      if (!analyser) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const session = testRef.current;
      const roomOpen =
        Boolean(session && canSpeak(session.state)) &&
        !busyRef.current &&
        !micPausedRef.current &&
        !submittingRef.current;
      const level = rmsFromAnalyser(analyser);
      const now = performance.now();
      const dt = lastTickAtRef.current ? Math.min(80, now - lastTickAtRef.current) : 16;
      lastTickAtRef.current = now;
      if (now - lastMeterAtRef.current > 80) {
        lastMeterAtRef.current = now;
        setMicLevel(level);
      }
      if (
        examinerSpeakingRef.current &&
        roomOpen &&
        !recordingRef.current &&
        !startingRef.current &&
        level >= SPEECH_START_RMS
      ) {
        bargeMsRef.current += dt;
        if (bargeMsRef.current >= BARGE_IN_MS) {
          bargeMsRef.current = 0;
          examinerSpeakingRef.current = false;
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setExaminerSpeaking(false);
          void beginUtterance();
        }
      } else if (!examinerSpeakingRef.current) {
        bargeMsRef.current = 0;
      }
      const open = roomOpen && !examinerSpeakingRef.current;
      const holding = recordingRef.current && level >= SPEECH_HOLD_RMS;
      const starting = open && level >= SPEECH_START_RMS;
      if (starting || holding) {
        lastVoiceAtRef.current = now;
        if (recordingRef.current) voicedMsRef.current += dt;
        if (!recordingRef.current && !startingRef.current && starting) void beginUtterance();
      } else if (recordingRef.current) {
        const quietFor = now - lastVoiceAtRef.current;
        const budget = silenceBudget(session?.state ?? "PART1");
        if (quietFor >= budget && voicedMsRef.current >= MIN_VOICED_MS) {
          void finishUtterance();
        } else if (quietFor >= 2000 && voicedMsRef.current < NOISE_BLIP_MS) {
          void cancelUtterance();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopVad() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setListening(false);
  }

  async function beginUtterance() {
    const session = testRef.current;
    if (!session || recordingRef.current || startingRef.current || !canSpeak(session.state)) return;
    const current = currentTurn(session);
    if (!current) return;
    startingRef.current = true;
    recordingRef.current = true;
    try {
      const stream = await ensureStream();
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start(200);
      speechStartedAtRef.current = performance.now();
      lastVoiceAtRef.current = performance.now();
      voicedMsRef.current = 0;
      setRecording(true);
      const total = current.timingSeconds ?? 45;
      setTotalSeconds(total);
      setSecondsLeft(total);
      void postRealtimeEvent("candidate_speaking_started", "candidate", { startedAt: new Date().toISOString() });
    } catch (err) {
      recordingRef.current = false;
      setRecording(false);
      setError(err instanceof Error ? err.message : "Microphone failed");
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecorder(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;
    if (typeof recorder.requestData === "function") recorder.requestData();
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    recorderRef.current = null;
    startingRef.current = false;
    return blob;
  }

  async function cancelUtterance() {
    recordingRef.current = false;
    voicedMsRef.current = 0;
    await stopRecorder();
    chunksRef.current = [];
    setRecording(false);
    setSecondsLeft(null);
  }

  async function finishUtterance() {
    const session = testRef.current;
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    recordingRef.current = false;
    const blob = await stopRecorder();
    setRecording(false);
    setSecondsLeft(null);
    void postRealtimeEvent("candidate_speaking_stopped", "candidate", { endedAt: new Date().toISOString() });
    const current = currentTurn(session);
    if (!current || !blob || blob.size < MIN_BLOB_BYTES) {
      submittingRef.current = false;
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await api.realtimeTurnAudio(session.testId, current.id, blob);
      setTest(next.test);
      setExaminerUrl(next.examinerPlaybackUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send audio");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function finish() {
    const session = testRef.current;
    if (!session) return;
    stopVad();
    setBusy(true);
    setError(null);
    try {
      const submitted = await api.finish(session.testId);
      navigate(`/tests/${submitted.testId}/processing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (!test) {
    return <section className="panel">{error ?? "Preparing the room..."}</section>;
  }

  if (test.state === "READY") {
    return (
      <section className="panel stack live-room">
        <p className="eyebrow">Live speaking room</p>
        <h1>Join the examiner.</h1>
        <PartSteps state={test.state} />
        <p className="lede">
          Talk with the examiner as in a real interview. Start speaking when you are ready — even if they are still
          finishing the question. A thinking pause is fine. Scoring happens quietly in the background.
        </p>
        <p className="muted">No written question paper is shown on screen.</p>
        {error && <div className="error">{error}</div>}
        <button onClick={beginLiveRoom} disabled={busy}>
          {busy ? "Connecting..." : "Start live exam"}
        </button>
      </section>
    );
  }

  if (test.state === "UPLOADING") {
    return (
      <section className="panel stack live-room">
        <p className="eyebrow">Exam complete</p>
        <h1>Close the live room and score it.</h1>
        <PartSteps state={test.state} />
        <p className="muted">
          All spoken turns are saved. Finish now to run transcription, language analysis, pronunciation checks, and
          report building.
        </p>
        {error && <div className="error">{error}</div>}
        <button onClick={finish} disabled={busy}>
          {busy ? "Submitting..." : "Finish exam"}
        </button>
      </section>
    );
  }

  const room = roomCopy({
    state: test.state,
    examinerSpeaking,
    recording,
    busy,
    listening,
    micPaused,
  });
  const bars = [0.04, 0.08, 0.12, 0.08, 0.05];
  const youHot = room.mode === "speak";
  const examinerHot = room.mode === "listen";

  return (
    <section className="panel stack live-room">
      <audio
        ref={audioRef}
        className="visually-hidden"
        muted={muted}
        onPlay={() => {
          setExaminerSpeaking(true);
          void postRealtimeEvent("examiner_playback_started", "examiner");
        }}
        onEnded={() => {
          setExaminerSpeaking(false);
          void postRealtimeEvent("examiner_playback_ended", "examiner");
        }}
      />
      <div className="row between voice-topline">
        <div className="row">
          <span className="status-pill">{partLabel(test.state)}</span>
          {turn?.isFollowUp && <span className="status-pill subtle">Follow-up</span>}
        </div>
        <span className={`live-indicator ${connection === "live" ? "on" : ""}`}>
          <span className={`dot ${connection === "live" ? "on" : ""}`} />
          {connection === "live" ? "Connected" : connection === "connecting" ? "Connecting" : "Offline"}
        </span>
      </div>

      <div className={`room-stage ${room.mode}`} aria-live="assertive">
        <p className="room-kicker">{room.kicker}</p>
        <h1 className="room-title">{room.title}</h1>
        <p className="room-hint">{room.hint}</p>
        {youHot || recording ? (
          <div className="mic-meter" aria-hidden="true">
            {bars.map((threshold, index) => (
              <span
                key={index}
                className={micLevel >= threshold ? "on" : ""}
                style={{ height: `${8 + Math.min(34, micLevel * 280 + index * 2)}px` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="role-grid">
        <div className={`role-card ${examinerHot ? "hot-listen" : ""}`}>
          <b>Examiner</b>
          <p>{examinerHot ? "Speaking — listen" : "Waiting"}</p>
        </div>
        <div className={`role-card ${youHot ? "hot-speak" : ""}`}>
          <b>You</b>
          <p>
            {recording
              ? "Heard — keep going"
              : youHot
                ? "Your turn to speak"
                : micPaused
                  ? "Mic paused"
                  : busy
                    ? "Wait for the examiner"
                    : "Wait"}
          </p>
        </div>
      </div>
      <PartSteps state={test.state} />
      {test.state === "PART2_PREP" && secondsLeft !== null ? <TimerRing seconds={secondsLeft} total={totalSeconds} /> : null}
      {recording && secondsLeft !== null ? <TimerRing seconds={secondsLeft} total={totalSeconds} /> : null}
      {test.state === "PART2_PREP" && (
        <div className="row">
          {secondsLeft === null && <button onClick={startPrep}>Start one-minute preparation</button>}
          {secondsLeft !== null && (
            <button className="secondary" onClick={finishPrep}>
              I&apos;m ready to speak
            </button>
          )}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="secondary" onClick={() => setMicPaused((value: boolean) => !value)}>
          {micPaused ? "Resume microphone" : "Pause microphone"}
        </button>
        <button className="ghost" onClick={() => setMuted((value: boolean) => !value)}>
          {muted ? "Unmute examiner" : "Mute examiner"}
        </button>
        <button className="ghost" onClick={() => connectSocket(api.realtimeSocketUrl(test.testId))}>
          Reconnect
        </button>
        <button className="ghost" onClick={finish} disabled={busy}>
          End exam
        </button>
      </div>
    </section>
  );
}
