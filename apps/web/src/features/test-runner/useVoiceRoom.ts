import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type TestSession, type Turn } from "../../lib/api";
import { recorderMime, rmsFromAnalyser } from "../../lib/audio";
import { clearDraft, loadDraft, saveDraft } from "../../lib/drafts";

const SPEECH_START_RMS = 0.05;
const SPEECH_HOLD_RMS = 0.028;
const MIN_VOICED_MS = 2200;
const INTRO_MIN_VOICED_MS = 700;
const NOISE_BLIP_MS = 400;
const MIN_BLOB_BYTES = 2500;
const BARGE_IN_MS = 280;

export type ConnectionState = "idle" | "connecting" | "live" | "offline";

function silenceBudget(state: string, turn?: Turn): number {
  if (turn?.isIntro) return 1600;
  if (state === "PART2_SPEAK") return 8000;
  if (state === "PART3") return 4500;
  return 3200;
}

function minVoicedMs(turn?: Turn): number {
  return turn?.isIntro ? INTRO_MIN_VOICED_MS : MIN_VOICED_MS;
}

export function currentTurn(test: TestSession): Turn | undefined {
  if (test.currentTurn) return test.currentTurn;
  return test.turns.find(
    (item) => item.answerStatus !== "VALID" && item.answerStatus !== "READY",
  );
}

export function canSpeak(state: string): boolean {
  return state === "PART1" || state === "PART2_SPEAK" || state === "PART3";
}

export function useVoiceRoom(testId: string) {
  const navigate = useNavigate();
  const [test, setTest] = useState<TestSession | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("idle");
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
  const [restoredDraftAvailable, setRestoredDraftAvailable] = useState(false);

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
  const restoredDraftRef = useRef<Blob | null>(null);
  const pingResolverRef = useRef<(() => void) | null>(null);

  const turn = test ? currentTurn(test) : undefined;

  testRef.current = test;
  recordingRef.current = recording;
  busyRef.current = busy;
  examinerSpeakingRef.current = examinerSpeaking;
  micPausedRef.current = micPaused;

  useEffect(() => {
    api
      .getTest(testId)
      .then(setTest)
      .catch((err: Error) => setError(err.message));
    void _checkDraft().catch(() =>
      setError("Local recording recovery is unavailable in this browser."),
    );
  }, [testId]);

  async function _checkDraft() {
    const saved = await loadDraft(testId, "current-turn");
    if (saved) {
      const shouldRestore = window.confirm("Restore your unsaved recording?");
      if (shouldRestore) {
        restoredDraftRef.current = saved;
        setRestoredDraftAvailable(true);
        setError("Unsaved recording restored. Send it when you are ready.");
      } else {
        await clearDraft(testId, "current-turn");
      }
    }
  }

  useEffect(() => {
    return () => {
      stopVad();
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      socketRef.current?.close();
      streamRef.current
        ?.getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
      void audioContextRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (testRef.current?.state === "PART2_PREP") void finishPrep();
      else if (recordingRef.current) void finishUtterance();
      return;
    }
    const timer = window.setTimeout(
      () => setSecondsLeft(secondsLeft - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  useEffect(() => {
    if (!examinerUrl || !audioRef.current) return;
    audioRef.current.src = examinerUrl;
    void audioRef.current
      .play()
      .catch(() =>
        setError(
          "Question audio could not play. Use Replay question to try again.",
        ),
      );
  }, [examinerUrl]);

  useEffect(() => {
    const session = test;
    if (!session || !canSpeak(session.state) || micPaused || restoredDraftAvailable) {
      stopVad();
      return;
    }
    void startVad().catch((err: Error) =>
      setError(err.message || "Could not open the microphone."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.state, test?.testId, micPaused, restoredDraftAvailable]);

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
      setError(
        err instanceof Error ? err.message : "Could not start live room",
      );
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
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string };
        if (message.type === "pong") {
          pingResolverRef.current?.();
          pingResolverRef.current = null;
        }
      } catch {
        return;
      }
    };
    socket.onerror = () => {
      if (socketRef.current === socket) setConnection("offline");
    };
    socket.onclose = () => {
      if (socketRef.current === socket) setConnection("offline");
    };
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
    if (!session || session.state !== "PART2_PREP" || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSecondsLeft(null);
    try {
      const next = await api.transition(
        session.testId,
        "COMPLETE_PART2_PREP",
        session.revision,
      );
      setTest(next);
      await postRealtimeEvent("part2_prep_completed", "system");
      await startVad();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start your speaking turn. Try preparation again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function ensureStream(): Promise<MediaStream> {
    if (streamRef.current) return streamRef.current;
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
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
        !restoredDraftRef.current &&
        !submittingRef.current;
      const level = rmsFromAnalyser(analyser);
      const now = performance.now();
      const dt = lastTickAtRef.current
        ? Math.min(80, now - lastTickAtRef.current)
        : 16;
      lastTickAtRef.current = now;
      if (now - lastMeterAtRef.current > 80) {
        lastMeterAtRef.current = now;
        setMicLevel(level);
      }
      const activeTurn = session ? currentTurn(session) : undefined;
      if (
        examinerSpeakingRef.current &&
        roomOpen &&
        !recordingRef.current &&
        !startingRef.current &&
        !activeTurn?.isIntro &&
        level >= SPEECH_START_RMS
      ) {
        bargeMsRef.current += dt;
        if (bargeMsRef.current >= BARGE_IN_MS) {
          bargeMsRef.current = 0;
          examinerSpeakingRef.current = false;
          if (audioRef.current) {
            audioRef.current.volume = 0.3;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setTimeout(() => {
              if (audioRef.current) audioRef.current.volume = 1.0;
            }, 500);
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
        if (!recordingRef.current && !startingRef.current && starting)
          void beginUtterance();
      } else if (recordingRef.current) {
        const quietFor = now - lastVoiceAtRef.current;
        const budget = silenceBudget(session?.state ?? "PART1", activeTurn);
        const voicedNeeded = minVoicedMs(activeTurn);
        if (quietFor >= budget && voicedMsRef.current >= voicedNeeded) {
          void finishUtterance();
        } else if (quietFor >= 2000 && voicedMsRef.current < NOISE_BLIP_MS) {
          void cancelUtterance();
          if (voicedMsRef.current > 0 && voicedMsRef.current < 2200) {
            setError(
              "We only caught a short sound. Start speaking again when you’re ready.",
            );
          }
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
    if (
      !session ||
      recordingRef.current ||
      startingRef.current ||
      !canSpeak(session.state)
    )
      return;
    const current = currentTurn(session);
    if (!current) return;
    startingRef.current = true;
    recordingRef.current = true;
    try {
      const stream = await ensureStream();
      const mime = recorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
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
      void postRealtimeEvent("candidate_speaking_started", "candidate", {
        startedAt: new Date().toISOString(),
      });
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
      recorder.onstop = () =>
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          }),
        );
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

  async function finishUtterance(): Promise<boolean> {
    const session = testRef.current;
    if (!session || submittingRef.current) return false;
    submittingRef.current = true;
    recordingRef.current = false;
    const blob = await stopRecorder();
    setRecording(false);
    setSecondsLeft(null);
    void postRealtimeEvent("candidate_speaking_stopped", "candidate", {
      endedAt: new Date().toISOString(),
    });
    const current = currentTurn(session);
    if (!current || !blob || blob.size < MIN_BLOB_BYTES) {
      submittingRef.current = false;
      setError(
        "That recording was too short to save. Please try your answer again.",
      );
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await saveDraft(testId, "current-turn", blob);
      const next = await api.realtimeTurnAudio(
        session.testId,
        current.id,
        blob,
      );
      await clearDraft(testId, "current-turn");
      restoredDraftRef.current = null;
      setRestoredDraftAvailable(false);
      setTest(next.test);
      testRef.current = next.test;
      setExaminerUrl(next.examinerPlaybackUrl ?? null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send audio");
      stopVad();
      restoredDraftRef.current = blob;
      setRestoredDraftAvailable(true);
      return false;
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function finish() {
    if (busyRef.current || submittingRef.current) return;
    if (recordingRef.current && !(await finishUtterance())) return;
    const session = testRef.current;
    if (!session) return;
    stopVad();
    audioRef.current?.pause();
    setBusy(true);
    setError(null);
    try {
      const submitted = await api.finish(session.testId);
      navigate(`/tests/${submitted.testId}/processing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
      if (!micPausedRef.current)
        void startVad().catch(() =>
          setError(
            "Could not resume your microphone. Reopen the session to continue.",
          ),
        );
    } finally {
      setBusy(false);
    }
  }

  async function replayExaminer() {
    if (!turn || recordingRef.current || busyRef.current) return;
    setError(null);
    try {
      const playback = await api.examinerAudio(testId, turn.id);
      if (audioRef.current) {
        audioRef.current.src = playback.playbackUrl;
        audioRef.current.muted = false;
        setMuted(false);
        await audioRef.current.play();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not replay this question.",
      );
    }
  }

  async function toggleMicrophone() {
    const paused = !micPausedRef.current;
    micPausedRef.current = paused;
    setMicPaused(paused);
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = !paused;
    });
    if (paused && recordingRef.current) await finishUtterance();
  }

  async function retakeTurn(turnId: string) {
    setBusy(true);
    setError(null);
    try {
      setTest(await api.retakeTurn(testId, turnId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not retake this answer.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendRestoredDraft() {
    const session = testRef.current;
    const current = session ? currentTurn(session) : undefined;
    const blob = restoredDraftRef.current;
    if (!session || !current || !blob) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.realtimeTurnAudio(
        session.testId,
        current.id,
        blob,
      );
      await clearDraft(testId, "current-turn");
      restoredDraftRef.current = null;
      setRestoredDraftAvailable(false);
      setTest(next.test);
      setExaminerUrl(next.examinerPlaybackUrl ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore the recording",
      );
    } finally {
      setBusy(false);
    }
  }

  async function discardRestoredDraft() {
    restoredDraftRef.current = null;
    setRestoredDraftAvailable(false);
    await clearDraft(testId, "current-turn");
  }

  function ping(): Promise<void> {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      pingResolverRef.current = resolve;
      socketRef.current?.send(JSON.stringify({ type: "ping" }));
      window.setTimeout(() => {
        if (pingResolverRef.current !== null) {
          pingResolverRef.current = null;
          resolve();
        }
      }, 3000);
    });
  }

  return {
    test,
    connection,
    secondsLeft,
    totalSeconds,
    busy,
    recording,
    listening,
    examinerSpeaking,
    muted,
    micPaused,
    error,
    micLevel,
    restoredDraftAvailable,
    turn,
    audioRef,
    setMuted,
    setMicPaused,
    toggleMicrophone,
    replayExaminer,
    setExaminerSpeaking,
    postRealtimeEvent,
    beginLiveRoom,
    startPrep,
    finishPrep,
    finish,
    finishAnswer: finishUtterance,
    sendRestoredDraft,
    discardRestoredDraft,
    reconnect: () => connectSocket(api.realtimeSocketUrl(testId)),
    ping,
    retakeTurn,
  };
}
