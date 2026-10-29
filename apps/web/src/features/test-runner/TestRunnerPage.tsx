import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Headphones,
  LogOut,
  Mic,
  MicOff,
  RefreshCw,
  Square,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, Card, IconTile, LoadingState, TimerRing, useConfirm } from "../../components/studio";
import { PartSteps } from "../../components/layout/PartSteps";
import { partLabel } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { RoomStage } from "./RoomStage";
import { roomCopy } from "./roomCopy";
import { useVoiceRoom } from "./useVoiceRoom";
import { QuestionPanel } from "./QuestionPanel";
import { NextQuestionLoader } from "./NextQuestionLoader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const READY_TIPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Mic,
    title: "Just start talking.",
    body: "Your answer records as soon as you speak — even if the examiner is still finishing the question.",
  },
  {
    icon: Clock,
    title: "Pause when you’re done.",
    body: "A few seconds of silence, or the Done speaking button, sends your answer. A short thinking pause mid-answer is fine.",
  },
  { icon: Headphones, title: "Find a quiet spot.", body: "Headphones stop the examiner’s voice from being picked up as your answer." },
];

export function TestRunnerPage() {
  const { testId = "" } = useParams();
  const navigate = useNavigate();
  const room = useVoiceRoom(testId);
  const { test, error } = room;
  const { confirm, dialog } = useConfirm();
  const [showQuestion, setShowQuestion] = useState(true);
  useDocumentTitle(test ? partLabel(test.state, { isFollowUp: room.turn?.isFollowUp }) : "Speaking room");

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
      <LogOut /> Exit
    </Button>
  );

  if (!test) {
    return (
      <AppShell
        variant="focus"
        focusAction={
          <Button variant="ghost" size="sm" to="/">
            Back to overview
          </Button>
        }
      >
        <div className="grid min-h-[50vh] place-items-center">
          {error ? (
            <div className="grid w-full max-w-lg gap-4">
              <Alert tone="error" title="We couldn’t open this test">
                {error}
              </Alert>
              <Button variant="secondary" to="/" className="justify-self-start">
                Back to overview
              </Button>
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
      <AppShell
        variant="focus"
        focusAction={
          <Button variant="ghost" size="sm" to="/">
            Not now
          </Button>
        }
      >
        {dialog}
        <Card className="mx-auto grid w-full max-w-[760px] gap-6 md:p-8" aria-labelledby="ready-title">
          <div className="grid gap-1.5">
            <p className="kicker">Live speaking room</p>
            <h1 id="ready-title">You’re ready to begin.</h1>
            <p className="text-muted-foreground">
              The examiner asks each question out loud and you answer out loud, just like the real test.
            </p>
          </div>
          <PartSteps state={test.state} />
          <ul className="grid gap-3.5 rounded-lg bg-background px-5 py-4 text-sm">
            {READY_TIPS.map((tip) => {
              const Icon = tip.icon;
              return (
                <li key={tip.title} className="flex items-start gap-3">
                  <IconTile size="sm" className="bg-card">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </IconTile>
                  <span className="pt-1.5">
                    <strong>{tip.title}</strong> {tip.body}
                  </span>
                </li>
              );
            })}
          </ul>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={room.beginLiveRoom} loading={room.busy}>
              {room.busy ? "Connecting…" : "Start the exam"}
              {!room.busy && <ArrowRight />}
            </Button>
            <span className="text-[13px] text-muted-foreground">Scoring happens after you finish.</span>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (test.state === "UPLOADING") {
    return (
      <AppShell
        variant="focus"
        focusAction={
          <Button variant="ghost" size="sm" to="/">
            Back to overview
          </Button>
        }
      >
        <Card className="mx-auto grid w-full max-w-[760px] justify-items-start gap-6 md:p-8" aria-labelledby="done-title">
          <span
            className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground ring-8 ring-indigo-soft"
            aria-hidden="true"
          >
            <Check className="size-7" />
          </span>
          <div className="grid gap-1.5">
            <p className="kicker">Exam complete</p>
            <h1 id="done-title">That’s the end of the test.</h1>
            <p className="text-muted-foreground">
              All your answers are saved. Submit them for scoring — your report is usually ready within a couple of minutes.
            </p>
          </div>
          <PartSteps state={test.state} compact />
          {error && <Alert tone="error">{error}</Alert>}
          <Button size="lg" onClick={room.finish} loading={room.busy}>
            {room.busy ? "Submitting…" : "Get my report"}
            {!room.busy && <ArrowRight />}
          </Button>
        </Card>
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
  const awaitingNextQuestion = copy.mode === "think" || room.examinerCue === "buffering";
  const showRing = room.secondsLeft !== null && room.recording;
  const lastCompletedTurn = [...test.turns].reverse().find((item) => item.answerStatus === "VALID" || item.answerStatus === "READY");

  return (
    <AppShell variant="focus" focusAction={exitAction}>
      {dialog}
      <div className="mx-auto grid w-full max-w-[1080px] gap-4">
        <section className="grid gap-4 rounded-lg border border-border bg-card p-4 md:gap-5 md:p-6" aria-label="Speaking room">
          <audio
            ref={room.audioRef}
            className="sr-only"
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 md:pb-4">
            <PartSteps state={test.state} compact />
            <div className="flex items-center gap-2">
              {room.turn?.isFollowUp && <Badge tone="dark">Follow-up</Badge>}
              {room.muted && <Badge>Examiner muted</Badge>}
              {room.connection === "live" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="size-2 rounded-full bg-success ring-2 ring-success-soft" aria-hidden="true" /> Live
                </span>
              )}
              {room.connection === "connecting" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="size-2 rounded-full bg-input" aria-hidden="true" /> Connecting…
                </span>
              )}
              {room.connection === "offline" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
                  <span className="size-2 rounded-full bg-gold" aria-hidden="true" /> Connection lost ·{" "}
                  <button type="button" className="underline" onClick={room.reconnect}>
                    Reconnect
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] md:gap-8">
            <div className="grid gap-4 border-b border-border pb-4 md:border-r md:border-b-0 md:pr-6 md:pb-0 md:min-h-full">
              <RoomStage
                room={copy}
                showMeter={youHot || room.recording}
                micLevel={room.micLevel}
                secondsLeft={room.secondsLeft}
                totalSeconds={room.totalSeconds}
              />
              {showRing && (
                <div className="justify-self-end md:justify-self-center">
                  <TimerRing seconds={room.secondsLeft ?? 0} total={room.totalSeconds} />
                </div>
              )}
            </div>

            <div className="grid min-w-0 content-start gap-4">
              {awaitingNextQuestion ? (
                <NextQuestionLoader title={copy.title} hint={copy.hint} />
              ) : (
                room.turn && (
                  <div className="grid gap-3 rounded-lg border border-border bg-background p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="kicker">{room.turn.isIntro ? "Introduction" : "Current question"}</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
                        aria-expanded={showQuestion}
                        onClick={() => setShowQuestion(!showQuestion)}
                      >
                        {showQuestion ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        {showQuestion ? "Hide text" : "Show text"}
                      </button>
                    </div>
                    {showQuestion ? (
                      <p className="text-base leading-relaxed text-foreground md:text-lg">{room.turn.promptText}</p>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">
                        Question text hidden — listen like the real test. Replay it any time.
                      </p>
                    )}
                    {room.turn.cueCard && (
                      <div className="grid gap-2 rounded-lg border border-gold/30 bg-gold-soft/60 px-4 py-3.5 text-sm">
                        <span className="kicker text-gold">Cue card</span>
                        <strong className="text-base">{room.turn.cueCard.title}</strong>
                        <span className="text-[13px] text-muted-foreground">You should say:</span>
                        <ul className="grid gap-1.5 pl-5 text-subtle marker:text-gold [list-style:disc]">
                          {room.turn.cueCard.prompts?.map((prompt) => (
                            <li key={prompt}>{prompt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="justify-self-start"
                      onClick={room.replayExaminer}
                      disabled={
                        room.recording ||
                        room.busy ||
                        room.examinerSpeaking ||
                        room.examinerCue === "buffering" ||
                        !room.turn.hasExaminerAudio
                      }
                    >
                      <Volume2 /> Replay question
                    </Button>
                  </div>
                )
              )}

              {test.state === "PART2_PREP" && (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                  {room.secondsLeft === null ? (
                    <Button size="lg" onClick={room.startPrep}>
                      <Clock /> Start one-minute preparation
                    </Button>
                  ) : (
                    <Button size="lg" onClick={room.finishPrep} loading={room.busy}>
                      I’m ready to speak <ArrowRight />
                    </Button>
                  )}
                  <span className="text-[13px] text-muted-foreground">You can make notes on paper, as in the real test.</span>
                </div>
              )}

              {room.notice && (
                <Alert
                  tone="info"
                  action={
                    <button
                      type="button"
                      className="inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                      onClick={room.dismissNotice}
                      aria-label="Dismiss"
                    >
                      <X className="size-4" />
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

              <div
                className={cn(
                  "no-print flex flex-wrap items-center gap-2 border-t border-border pt-4",
                  "max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:-mb-4 max-md:rounded-b-lg max-md:bg-card/95 max-md:px-4 max-md:pb-[calc(12px+env(safe-area-inset-bottom))] max-md:backdrop-blur",
                )}
              >
                {room.recording && (
                  <Button onClick={() => void room.finishAnswer()} disabled={room.busy} className="max-md:flex-1">
                    <Check /> Done speaking
                  </Button>
                )}
                {room.restoredDraftAvailable && (
                  <>
                    <Button onClick={room.sendRestoredDraft} loading={room.busy} className="max-md:flex-1">
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
                  className="max-md:flex-1"
                >
                  {room.micPaused ? <Mic /> : <MicOff />}
                  {room.micPaused ? "Resume mic" : "Pause mic"}
                </Button>
                <Button variant="danger" className="md:ml-auto" onClick={endExam} disabled={room.busy || room.restoredDraftAvailable}>
                  <Square className="size-3.5" /> End exam
                </Button>
              </div>
              <Collapsible className="no-print">
                <CollapsibleTrigger className="group inline-flex items-center gap-1 py-1 text-sm font-medium text-subtle hover:text-foreground">
                  More controls <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" aria-pressed={room.muted} onClick={() => room.setMuted(!room.muted)}>
                      <Volume2 />
                      {room.muted ? "Unmute examiner" : "Mute examiner"}
                    </Button>
                    {lastCompletedTurn && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => room.retakeTurn(lastCompletedTurn.id)}
                        disabled={room.busy || room.recording || room.restoredDraftAvailable}
                      >
                        <RefreshCw /> Retake last answer
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={room.reconnect}>
                      Reconnect live updates
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </section>

        <Collapsible className="rounded-lg border border-border bg-card">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
            <span className="grid gap-0.5">
              <strong>Session details</strong>
              <span className="text-[13px] text-muted-foreground">Questions so far, your transcripts, and a guide to each part</span>
            </span>
            <ChevronDown
              className="size-[18px] shrink-0 text-muted-foreground transition-transform group-data-open:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5">
              <QuestionPanel test={test} turn={room.turn} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AppShell>
  );
}
