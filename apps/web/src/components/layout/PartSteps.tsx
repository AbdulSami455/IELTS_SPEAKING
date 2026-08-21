export function PartSteps({ state }: { state: string }) {
  const part1Active = state === "READY" || state === "PART1";
  const part1Done = ["PART2_PREP", "PART2_SPEAK", "PART3", "UPLOADING"].includes(state);
  const part2Active = state.startsWith("PART2");
  const part2Done = state === "PART3" || state === "UPLOADING";
  const part3Active = state === "PART3";
  const part3Done = state === "UPLOADING";

  const parts = [
    { id: "1", label: "Interview", done: part1Done, on: part1Active },
    { id: "2", label: "Long turn", done: part2Done, on: part2Active },
    { id: "3", label: "Discussion", done: part3Done, on: part3Active },
  ];

  return (
    <div className="steps">
      {parts.map((part) => (
        <div
          key={part.id}
          className={`step${part.done ? " done" : ""}${part.on ? " on" : ""}`}
          aria-current={part.on ? "step" : undefined}
        >
          <span className="step-n">Part {part.id}</span>
          {part.label}
        </div>
      ))}
    </div>
  );
}
