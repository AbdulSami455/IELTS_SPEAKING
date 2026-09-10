export interface RoomCopy {
  mode: "prep" | "listen" | "think" | "speak" | "wait";
  kicker: string;
  title: string;
  hint: string;
}

interface RoomCopyArgs {
  state: string;
  examinerSpeaking: boolean;
  recording: boolean;
  busy: boolean;
  listening: boolean;
  micPaused: boolean;
  pendingRecording?: boolean;
}

export function roomCopy(args: RoomCopyArgs): RoomCopy {
  if (args.pendingRecording) {
    return {
      mode: "wait",
      kicker: "Recording saved locally",
      title: "Retry your answer",
      hint: "The last request did not finish. Retry the saved recording below to continue. Your microphone is paused.",
    };
  }
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
      kicker: "Your AI examiner",
      title: "Listen to the question",
      hint: "Start answering when you’re ready. Speaking will stop the question.",
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
      kicker: "Recording",
      title: "Keep speaking",
      hint: "Your answer saves automatically after a longer pause.",
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
      title: "Over to you.",
      hint: "Your microphone is on. Start speaking when you’re ready.",
    };
  }
  return {
    mode: "wait",
    kicker: "Room",
    title: "Getting ready",
    hint: "The microphone is opening.",
  };
}
