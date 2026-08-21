import { useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, TimerRing } from "../../components/ui";
import { PartSteps } from "../../components/layout/PartSteps";
import { partLabel } from "../../lib/format";
import { RoomStage } from "./RoomStage";
import { roomCopy } from "./roomCopy";
import { useVoiceRoom } from "./useVoiceRoom";

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const room = useVoiceRoom(testId);
  const { test, error } = room;

  if (!test) {
    return (
      <AppShell>
        <div className="center-page">
          <p>{error ?? "Preparing the room…"}</p>
        </div>
      </AppShell>
    );
  }

  if (test.state === "READY") {
    return (
      <AppShell>
        <section className="stack live-room">
          <div className="section-head">
            <p className="eyebrow">Live speaking room</p>
            <h1>Join the examiner.</h1>
          </div>
          <PartSteps state={test.state} />
          <p className="lede">
            Talk with the examiner as in a real interview. Start speaking when you are ready — even if they are
            still finishing the question. A thinking pause is fine. Scoring happens quietly in the background.
          </p>
          <p className="muted">No written question paper is shown on screen.</p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="row">
            <Button size="lg" onClick={room.beginLiveRoom} loading={room.busy}>
              {room.busy ? "Connecting…" : "Start live exam"}
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  if (test.state === "UPLOADING") {
    return (
      <AppShell>
        <section className="stack live-room">
          <div className="section-head">
            <p className="eyebrow">Exam complete</p>
            <h1>Close the live room and score it.</h1>
          </div>
          <PartSteps state={test.state} />
          <p className="muted">
            All spoken turns are saved. Finish now to run transcription, language analysis, pronunciation checks,
            and report building.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="row">
            <Button size="lg" onClick={room.finish} loading={room.busy}>
              {room.busy ? "Submitting…" : "Finish exam"}
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  const copy = roomCopy({
    state: test.state,
    examinerSpeaking: room.examinerSpeaking,
    recording: room.recording,
    busy: room.busy,
    listening: room.listening,
    micPaused: room.micPaused,
  });
  const youHot = copy.mode === "speak";
  const examinerHot = copy.mode === "listen";
  const showRing = room.secondsLeft !== null && (test.state === "PART2_PREP" || room.recording);

  return (
    <AppShell>
      <section className="stack live-room">
        <audio
          ref={room.audioRef}
          className="visually-hidden"
          muted={room.muted}
          onPlay={() => {
            room.setExaminerSpeaking(true);
            void room.postRealtimeEvent("examiner_playback_started", "examiner");
          }}
          onEnded={() => {
            room.setExaminerSpeaking(false);
            void room.postRealtimeEvent("examiner_playback_ended", "examiner");
          }}
        />
        <div className="row between voice-topline">
          <div className="row">
            <Badge>{partLabel(test.state)}</Badge>
            {room.turn?.isFollowUp && <Badge tone="dark">Follow-up</Badge>}
          </div>
          <span className={`live-indicator${room.connection === "live" ? " on" : ""}`}>
            <span className={`dot${room.connection === "live" ? " on" : ""}`} aria-hidden="true" />
            {room.connection === "live"
              ? "Connected"
              : room.connection === "connecting"
                ? "Connecting"
                : "Offline"}
          </span>
        </div>

        <RoomStage room={copy} showMeter={youHot || room.recording} micLevel={room.micLevel} />

        <div className="role-grid">
          <div className={`role-card${examinerHot ? " hot-listen" : ""}`}>
            <b>Examiner</b>
            <p>{examinerHot ? "Speaking — listen" : "Waiting"}</p>
          </div>
          <div className={`role-card${youHot ? " hot-speak" : ""}`}>
            <b>You</b>
            <p>
              {room.recording
                ? "Heard — keep going"
                : youHot
                  ? "Your turn to speak"
                  : room.micPaused
                    ? "Mic paused"
                    : room.busy
                      ? "Wait for the examiner"
                      : "Wait"}
            </p>
          </div>
        </div>

        <PartSteps state={test.state} />
        {showRing && <TimerRing seconds={room.secondsLeft ?? 0} total={room.totalSeconds} />}

        {test.state === "PART2_PREP" && (
          <div className="row">
            {room.secondsLeft === null && (
              <Button onClick={room.startPrep}>Start one-minute preparation</Button>
            )}
            {room.secondsLeft !== null && (
              <Button variant="secondary" onClick={room.finishPrep}>
                I&apos;m ready to speak
              </Button>
            )}
          </div>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="row no-print">
          <Button variant="secondary" size="sm" onClick={() => room.setMicPaused(!room.micPaused)}>
            {room.micPaused ? "Resume microphone" : "Pause microphone"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => room.setMuted(!room.muted)}>
            {room.muted ? "Unmute examiner" : "Mute examiner"}
          </Button>
          <Button variant="ghost" size="sm" onClick={room.reconnect}>
            Reconnect
          </Button>
          <Button variant="ghost" size="sm" onClick={room.finish} disabled={room.busy}>
            End exam
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
