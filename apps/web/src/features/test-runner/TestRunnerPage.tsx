import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, TimerRing } from "../../components/ui";
import { PartSteps } from "../../components/layout/PartSteps";
import { partLabel } from "../../lib/format";
import { RoomStage } from "./RoomStage";
import { roomCopy } from "./roomCopy";
import { useVoiceRoom } from "./useVoiceRoom";
import { QuestionPanel } from "./QuestionPanel";
import { Icon } from "../../components/ui/Icon";

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const room = useVoiceRoom(testId);
  const { test, error } = room;
  const [showQuestion, setShowQuestion] = useState(true);
  if (!test) {
    return (
      <AppShell>
        <div className="center-page">
          <div className="stack">
            <p role="status">{error ?? "Preparing the room…"}</p>
            {error && (
              <Link to="/" className="btn btn--secondary">
                Back to overview
              </Link>
            )}
          </div>
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
            Talk with the examiner as in a real interview. Start speaking when
            you are ready — even if they are still finishing the question. A
            thinking pause is fine. Scoring happens quietly in the background.
          </p>
          <p className="muted">
            Open session details to review questions and available transcripts.
          </p>
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
            All spoken turns are saved. Finish now to run transcription,
            language analysis, pronunciation checks, and report building.
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
  const showRing = room.secondsLeft !== null && room.recording;
  const lastCompletedTurn = [...test.turns]
    .reverse()
    .find(
      (item) => item.answerStatus === "VALID" || item.answerStatus === "READY",
    );

  return (
    <AppShell>
      <div className="speaking-layout speaking-layout--focused">
        <section className="stack speaking-main">
          <audio
            ref={room.audioRef}
            className="visually-hidden"
            muted={room.muted}
            onPlay={() => {
              room.setExaminerSpeaking(true);
              void room.postRealtimeEvent(
                "examiner_playback_started",
                "examiner",
              );
            }}
            onEnded={() => {
              room.setExaminerSpeaking(false);
              void room.postRealtimeEvent(
                "examiner_playback_ended",
                "examiner",
              );
            }}
          />
          <div className="row between voice-topline">
            <div className="row">
              <Badge>{partLabel(test.state)}</Badge>
              {room.turn?.isFollowUp && <Badge tone="dark">Follow-up</Badge>}
            </div>
            <span
              className={`live-indicator${room.connection === "live" ? " on" : ""}`}
            >
              <span
                className={`dot${room.connection === "live" ? " on" : ""}`}
                aria-hidden="true"
              />
              {room.connection === "live"
                ? "Connected"
                : room.connection === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </span>
          </div>

          <RoomStage
            room={copy}
            showMeter={youHot || room.recording}
            micLevel={room.micLevel}
            secondsLeft={room.secondsLeft}
            totalSeconds={room.totalSeconds}
          />

          {room.turn && (
            <div className="current-prompt stack">
              <div className="row between">
                <span className="kicker">Current question</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showQuestion}
                  onClick={() => setShowQuestion(!showQuestion)}
                >
                  {showQuestion ? "Hide question" : "Show question"}
                </Button>
              </div>
              {showQuestion && <p>{room.turn.promptText}</p>}
              {room.turn.cueCard && (
                <div className="cue-card stack-sm">
                  <strong>{room.turn.cueCard.title}</strong>
                  <ul className="list">
                    {room.turn.cueCard.prompts?.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={room.replayExaminer}
                disabled={
                  room.recording ||
                  room.busy ||
                  room.examinerSpeaking ||
                  !room.turn.hasExaminerAudio
                }
              >
                <Icon name="play" size={15} /> Replay question
              </Button>
            </div>
          )}

          {showRing && (
            <TimerRing
              seconds={room.secondsLeft ?? 0}
              total={room.totalSeconds}
            />
          )}

          {test.state === "PART2_PREP" && (
            <div className="row">
              {room.secondsLeft === null && (
                <Button onClick={room.startPrep}>
                  Start one-minute preparation
                </Button>
              )}
              {room.secondsLeft !== null && (
                <Button variant="secondary" onClick={room.finishPrep}>
                  I&apos;m ready to speak
                </Button>
              )}
            </div>
          )}

          {error && (
            <Alert tone="error">
              {error}
              {room.connection === "offline" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={room.reconnect}
                  style={{ marginLeft: 8 }}
                >
                  Try again
                </Button>
              )}
            </Alert>
          )}

          <div className="room-controls row no-print">
            {room.restoredDraftAvailable && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={room.sendRestoredDraft}
                  disabled={room.busy}
                >
                  Send restored recording
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={room.discardRestoredDraft}
                  disabled={room.busy}
                >
                  Discard restored recording
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={room.micPaused}
              onClick={room.toggleMicrophone}
              disabled={room.busy}
            >
              {room.micPaused ? "Resume microphone" : "Pause microphone"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "End this session and score your saved answers?",
                  )
                )
                  void room.finish();
              }}
              disabled={room.busy || room.restoredDraftAvailable}
            >
              End exam
            </Button>
          </div>
          <details className="room-options no-print">
            <summary>More controls</summary>
            <div className="row">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={room.muted}
              onClick={() => room.setMuted(!room.muted)}
            >
              {room.muted ? "Unmute examiner" : "Mute examiner"}
            </Button>
            {lastCompletedTurn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => room.retakeTurn(lastCompletedTurn.id)}
                disabled={
                  room.busy || room.recording || room.restoredDraftAvailable
                }
              >
                Retake last answer
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={room.reconnect}>
              Reconnect
            </Button>
            </div>
          </details>
        </section>

        <details className="session-details">
          <summary>Session details <span>Questions, transcripts &amp; guide</span></summary>
          <QuestionPanel test={test} turn={room.turn} />
        </details>
      </div>
    </AppShell>
  );
}
