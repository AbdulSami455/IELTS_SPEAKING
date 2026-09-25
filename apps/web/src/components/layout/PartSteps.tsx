import { Icon } from "../ui/Icon";

const PARTS = [
  { id: 1, label: "Interview", duration: "4–5 min" },
  { id: 2, label: "Long turn", duration: "3–4 min" },
  { id: 3, label: "Discussion", duration: "4–5 min" },
] as const;

function currentPartFor(state: string): number {
  if (state === "PART3") return 3;
  if (state.startsWith("PART2")) return 2;
  if (state === "UPLOADING") return 4;
  return 1;
}

export function PartSteps({ state, compact = false }: { state: string; compact?: boolean }) {
  const current = currentPartFor(state);
  const started = state !== "READY";

  return (
    <ol
      className={`steps${compact ? " steps--compact" : ""}`}
      aria-label={current > 3 ? "All three parts complete" : `Part ${current} of 3`}
    >
      {PARTS.map((part) => {
        const done = part.id < current;
        const on = part.id === current && started;
        return (
          <li
            key={part.id}
            className={`step${done ? " done" : ""}${on ? " on" : ""}`}
            aria-current={on ? "step" : undefined}
          >
            <span className="step-marker" aria-hidden="true">
              {done ? <Icon name="check" size={14} /> : part.id}
            </span>
            <span className="step-text">
              <span className="step-label">{part.label}</span>
              {!compact && <span className="step-meta">Part {part.id} · {part.duration}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
