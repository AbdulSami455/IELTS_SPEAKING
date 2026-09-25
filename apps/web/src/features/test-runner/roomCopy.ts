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
  isIntro?: boolean;
}

export function roomCopy(args: RoomCopyArgs): RoomCopy {
  if (args.pendingRecording) {
    return {
      mode: "wait",
      kicker: "Saved on this device",
      title: "Send your last answer",
      hint: "Your previous answer didn’t reach the examiner. Send it to continue, or discard it and answer again. The microphone is paused until then.",
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
      kicker: args.isIntro ? "Introduction" : "Your AI examiner",
      title: args.isIntro ? "Listen to the introduction" : "Listen to the question",
      hint: args.isIntro
        ? "Wait for the examiner to finish, then say your full name."
        : "Start answering when you’re ready. Speaking will stop the question.",
    };
  }
  if (args.busy) {
    return {
      mode: "think",
      kicker: "Next question",
      title: "Preparing your next question",
      hint: args.isIntro
        ? "Your introduction is saved. The examiner is choosing your first topic question."
        : "Take a breath — the examiner is listening to your answer and lining up what comes next.",
    };
  }
  if (args.recording) {
    return {
      mode: "speak",
      kicker: "Recording",
      title: args.isIntro ? "Say your full name" : "Keep speaking",
      hint: args.isIntro
        ? "A short pause or Done speaking will save your answer."
        : "Pause when finished, or tap Done speaking.",
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
