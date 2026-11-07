import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface TimerRingProps {
  seconds: number;
  total: number;
  size?: number;
  className?: string;
}

export function TimerRing({ seconds, total, size = 84, className }: TimerRingProps) {
  const pct = Math.max(0, Math.min(100, (seconds / Math.max(total, 1)) * 100));
  const urgent = seconds <= 10;
  return (
    <div
      className={cn("timer-ring", className)}
      style={{ "--p": pct, width: size, height: size } as CSSProperties}
      data-urgent={urgent}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <span className={cn("relative z-10 text-xl font-semibold tabular-nums", urgent ? "text-destructive" : "text-foreground")}>
        {seconds}s
      </span>
    </div>
  );
}
