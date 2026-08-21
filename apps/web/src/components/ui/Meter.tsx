interface MeterProps {
  value: number;
  max?: number;
  label?: string;
}

export function Meter({ value, max = 9, label }: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="meter"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
