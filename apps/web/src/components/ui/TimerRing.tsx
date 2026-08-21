import type { CSSProperties } from "react";

interface TimerRingProps {
  seconds: number;
  total: number;
}

export function TimerRing({ seconds, total }: TimerRingProps) {
  const pct = Math.max(0, Math.min(100, (seconds / Math.max(total, 1)) * 100));
  const urgent = seconds <= 10;
  return (
    <div className="timer-wrap">
      <div
        className={`timer-ring${urgent ? " urgent" : ""}`}
        style={{ "--p": pct } as CSSProperties}
        role="timer"
        aria-label={`${seconds} seconds remaining`}
      >
        <p className="timer">{seconds}s</p>
      </div>
    </div>
  );
}
