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
}

export function roomCopy(args: RoomCopyArgs): RoomCopy {
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
      title: "A conversation starts with listening.",
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
      kicker: "Your voice, your moment",
      title: "We’re listening to you.",
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
      title: "Over to you.",
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
