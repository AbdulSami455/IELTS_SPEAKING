import { cn } from "@/lib/utils";

interface MeterProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  className?: string;
}

export function Meter({ value, max = 9, label, color, className }: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span
        className="block h-full rounded-full bg-indigo-vivid transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
