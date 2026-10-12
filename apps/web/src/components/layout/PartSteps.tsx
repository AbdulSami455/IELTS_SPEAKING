import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className={cn(compact ? "flex items-center gap-1.5" : "grid gap-2 sm:grid-cols-3")}
      aria-label={current > 3 ? "All three parts complete" : `Part ${current} of 3`}
    >
      {PARTS.map((part, index) => {
        const done = part.id < current;
        const on = part.id === current && started;
        return (
          <li
            key={part.id}
            className={cn(
              "flex min-w-0 items-center gap-2.5",
              !compact && "rounded-lg border border-border bg-card px-3.5 py-3",
              !compact && on && "border-indigo-vivid/40 bg-indigo-soft",
            )}
            aria-current={on ? "step" : undefined}
          >
            {compact && index > 0 && (
              <span className={cn("h-px w-4 shrink-0", done || on ? "bg-primary" : "bg-input")} aria-hidden="true" />
            )}
            <span
              className={cn(
                "inline-grid shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-semibold",
                compact ? "size-[22px]" : "size-7",
                done ? "border-primary bg-primary text-primary-foreground" : on ? "border-primary text-primary ring-4 ring-indigo-soft" : "border-input text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3.5" /> : part.id}
            </span>
            <span className="grid min-w-0">
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  on ? "text-foreground" : done ? "text-subtle" : "text-muted-foreground",
                  compact && !on && "max-sm:sr-only",
                  on && "font-semibold",
                )}
              >
                {part.label}
              </span>
              {!compact && (
                <span className="text-xs text-muted-foreground">
                  Part {part.id} · {part.duration}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
