import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, LoadingState, TimerRing, useConfirm } from "../../components/ui";
import { PartSteps } from "../../components/layout/PartSteps";
import { partLabel } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { RoomStage } from "./RoomStage";
import { roomCopy } from "./roomCopy";
import { useVoiceRoom } from "./useVoiceRoom";
import { QuestionPanel } from "./QuestionPanel";
import { NextQuestionLoader } from "./NextQuestionLoader";
import { Icon, type IconName } from "../../components/ui/Icon";

const READY_TIPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "mic",
    title: "Just start talking.",
    body: "Your answer records as soon as you speak — even if the examiner is still finishing the question.",
  },
  {
    icon: "clock",
    title: "Pause when you’re done.",
    body: "A few seconds of silence, or the Done speaking button, sends your answer. A short thinking pause mid-answer is fine.",
  },
  {
    icon: "headphones",
    title: "Find a quiet spot.",
    body: "Headphones stop the examiner’s voice from being picked up as your answer.",
  },
];

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const room = useVoiceRoom(testId);
  const { test, error } = room;
  const { confirm, dialog } = useConfirm();
  const [showQuestion, setShowQuestion] = useState(true);
  useDocumentTitle(test ? partLabel(test.state) : "Speaking room");

  async function exitRoom() {
    const midAnswer = room.recording || room.busy;
    const ok = await confirm({
      title: "Leave the test for now?",
      body: midAnswer
        ? "The answer you’re giving right now won’t be saved. Earlier answers are safe, and you can resume from the overview."
        : "Your answers so far are saved. You can resume this test from the overview.",
      confirmLabel: "Leave test",
      cancelLabel: "Keep going",
    });
    if (ok) navigate("/");
  }

  async function endExam() {
    const ok = await confirm({
      title: "End the test now?",
      body: "We’ll score the answers you’ve given so far. You won’t be able to add more answers to this test.",
      confirmLabel: "End and score",
      cancelLabel: "Keep going",
      tone: "danger",
    });
    if (ok) void room.finish();
  }

  const exitAction = (
    <Button variant="ghost" size="sm" onClick={exitRoom}>
      <Icon name="logout" size={16} /> Exit
    </Button>
  );

  if (!test) {
    return (
      <AppShell variant="focus" focusAction={<Link className="btn btn--ghost btn--sm" to="/">Back to overview</Link>}>
        <div className="center-page">
          {error ? (
            <div className="center-panel stack">
              <Alert tone="error" title="We couldn’t open this test">
                {error}
              </Alert>
              <Link to="/" className="btn btn--secondary">
                Back to overview
              </Link>
            </div>
          ) : (
            <LoadingState label="Preparing the room…" />
          )}
        </div>
      </AppShell>
    );
  }

  if (test.state === "READY") {
    return (
      <AppShell variant="focus" focusAction={<Link className="btn btn--ghost btn--sm" to="/">Not now</Link>}>
        <section className="card stack live-room" aria-labelledby="ready-title">
          <div className="section-head">
            <p className="kicker">Live speaking room</p>
            <h1 id="ready-title">You’re ready to begin.</h1>
            <p className="muted">
              The examiner asks each question out loud and you answer out loud, just like the real test.
            </p>
          </div>
          <PartSteps state={test.state} />
          <ul className="ready-tips">
            {READY_TIPS.map((tip) => (
              <li key={tip.title}>
                <span className="icon-tile icon-tile--sm">
                  <Icon name={tip.icon} size={18} />
                </span>
                <span>
                  <strong>{tip.title}</strong> {tip.body}
                </span>
              </li>
            ))}
          </ul>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="row workflow-actions">
            <Button size="lg" onClick={room.beginLiveRoom} loading={room.busy}>
              {room.busy ? "Connecting…" : "Start the exam"}
              {!room.busy && <Icon name="arrow" size={18} />}
            </Button>
            <span className="caption">Scoring happens after you finish.</span>
          </div>
        </section>
      </AppShell>
    );
  }

  if (test.state === "UPLOADING") {
    return (
      <AppShell variant="focus" focusAction={<Link className="btn btn--ghost btn--sm" to="/">Back to overview</Link>}>
        <section className="card stack live-room live-room--complete" aria-labelledby="done-title">
          <span className="complete-mark" aria-hidden="true">
            <Icon name="check" size={28} />
          </span>
          <div className="section-head">
            <p className="kicker">Exam complete</p>
            <h1 id="done-title">That’s the end of the test.</h1>
            <p className="muted">
              All your answers are saved. Submit them for scoring — your report is usually ready within a couple of minutes.
            </p>
          </div>
          <PartSteps state={test.state} compact />
          {error && <Alert tone="error">{error}</Alert>}
          <div className="row workflow-actions">
            <Button size="lg" onClick={room.finish} loading={room.busy}>
              {room.busy ? "Submitting…" : "Get my report"}
              {!room.busy && <Icon name="arrow" size={18} />}
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
    pendingRecording: room.restoredDraftAvailable,
    isIntro: room.turn?.isIntro,
  });
  const youHot = copy.mode === "speak";
  const awaitingNextQuestion = copy.mode === "think";
  const showRing = room.secondsLeft !== null && room.recording;
  const lastCompletedTurn = [...test.turns]
    .reverse()
    .find((item) => item.answerStatus === "VALID" || item.answerStatus === "READY");

  return (
    <AppShell variant="focus" focusAction={exitAction}>
      {dialog}
      <div className="speaking-layout">
        <section className="stack speaking-main" aria-label="Speaking room">
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
          <div className="voice-topline">
            <PartSteps state={test.state} compact />
            <div className="row voice-status">
              {room.turn?.isFollowUp && <Badge tone="dark">Follow-up</Badge>}
              {room.muted && <Badge>Examiner muted</Badge>}
              {room.connection === "live" && (
                <span className="live-indicator on">
                  <span className="dot on" aria-hidden="true" /> Live
                </span>
              )}
              {room.connection === "connecting" && (
                <span className="live-indicator">
                  <span className="dot" aria-hidden="true" /> Connecting…
                </span>
              )}
              {room.connection === "offline" && (
                <span className="live-indicator off">
                  <span className="dot off" aria-hidden="true" /> Connection lost ·{" "}
                  <button type="button" className="link-button" onClick={room.reconnect}>
                    Reconnect
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="room-workspace">
            <div className="room-presence">
              <RoomStage
                room={copy}
                showMeter={youHot || room.recording}
                micLevel={room.micLevel}
                secondsLeft={room.secondsLeft}
                totalSeconds={room.totalSeconds}
              />
              {showRing && <TimerRing seconds={room.secondsLeft ?? 0} total={room.totalSeconds} />}
            </div>

            <div className="room-interaction stack">
              {awaitingNextQuestion ? (
                <NextQuestionLoader title={copy.title} hint={copy.hint} />
              ) : (
                room.turn && (
                  <div className="current-prompt stack">
                    <div className="row between">
                      <span className="kicker">{room.turn.isIntro ? "Introduction" : "Current question"}</span>
                      <button
                        type="button"
                        className="link-button"
                        aria-expanded={showQuestion}
                        onClick={() => setShowQuestion(!showQuestion)}
                      >
                        <Icon name={showQuestion ? "eyeOff" : "eye"} size={16} />
                        {showQuestion ? "Hide text" : "Show text"}
                      </button>
                    </div>
                    {showQuestion ? (
                      <p className="prompt-text">{room.turn.promptText}</p>
                    ) : (
                      <p className="caption">Question text hidden — listen like the real test. Replay it any time.</p>
                    )}
                    {room.turn.cueCard && (
                      <div className="cue-card stack-sm">
                        <span className="kicker">Cue card</span>
                        <strong>{room.turn.cueCard.title}</strong>
                        <span className="caption">You should say:</span>
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
                      disabled={room.recording || room.busy || room.examinerSpeaking || !room.turn.hasExaminerAudio}
                    >
                      <Icon name="volume" size={16} /> Replay question
                    </Button>
                  </div>
                )
              )}

              {test.state === "PART2_PREP" && (
                <div className="prep-actions">
                  {room.secondsLeft === null ? (
                    <Button size="lg" onClick={room.startPrep}>
                      <Icon name="clock" size={18} /> Start one-minute preparation
                    </Button>
                  ) : (
                    <Button size="lg" onClick={room.finishPrep} loading={room.busy}>
                      I’m ready to speak <Icon name="arrow" size={18} />
                    </Button>
                  )}
                  <span className="caption">You can make notes on paper, as in the real test.</span>
                </div>
              )}

              {room.notice && (
                <Alert
                  tone="info"
                  action={
                    <button type="button" className="icon-btn" onClick={room.dismissNotice} aria-label="Dismiss">
                      <Icon name="x" size={16} />
                    </button>
                  }
                >
                  {room.notice}
                </Alert>
              )}

              {error && (
                <Alert
                  tone="error"
                  action={
                    room.connection === "offline" && (
                      <Button size="sm" variant="secondary" onClick={room.reconnect}>
                        Try again
                      </Button>
                    )
                  }
                >
                  {error}
                </Alert>
              )}

              <div className="room-controls no-print">
                {room.recording && (
                  <Button onClick={() => void room.finishAnswer()} disabled={room.busy}>
                    <Icon name="check" size={17} /> Done speaking
                  </Button>
                )}
                {room.restoredDraftAvailable && (
                  <>
                    <Button onClick={room.sendRestoredDraft} loading={room.busy}>
                      Send saved answer
                    </Button>
                    <Button variant="ghost" onClick={room.discardRestoredDraft} disabled={room.busy}>
                      Discard and re-answer
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  aria-pressed={room.micPaused}
                  onClick={room.toggleMicrophone}
                  disabled={room.busy || room.restoredDraftAvailable}
                >
                  <Icon name={room.micPaused ? "mic" : "micOff"} size={17} />
                  {room.micPaused ? "Resume mic" : "Pause mic"}
                </Button>
                <Button
                  variant="danger"
                  className="room-end"
                  onClick={endExam}
                  disabled={room.busy || room.restoredDraftAvailable}
                >
                  <Icon name="square" size={15} /> End exam
                </Button>
              </div>
              <details className="room-options no-print">
                <summary>
                  More controls <Icon name="chevronDown" size={16} />
                </summary>
                <div className="row">
                  <Button variant="ghost" size="sm" aria-pressed={room.muted} onClick={() => room.setMuted(!room.muted)}>
                    <Icon name="volume" size={16} />
                    {room.muted ? "Unmute examiner" : "Mute examiner"}
                  </Button>
                  {lastCompletedTurn && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => room.retakeTurn(lastCompletedTurn.id)}
                      disabled={room.busy || room.recording || room.restoredDraftAvailable}
                    >
                      <Icon name="refresh" size={16} /> Retake last answer
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={room.reconnect}>
                    Reconnect live updates
                  </Button>
                </div>
              </details>
            </div>
          </div>
        </section>

        <details className="session-details">
          <summary>
            <span>
              <strong>Session details</strong>
              <span className="caption">Questions so far, your transcripts, and a guide to each part</span>
            </span>
            <Icon name="chevronDown" size={18} />
          </summary>
          <QuestionPanel test={test} turn={room.turn} />
        </details>
      </div>
    </AppShell>
  );
}
