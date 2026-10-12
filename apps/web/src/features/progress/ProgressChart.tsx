import { useState, type ReactNode } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import type { ProgressOverview } from "../../lib/api";
import { OVERALL_COLOR } from "../../lib/criteria";
import { bandDomain, bandText, formatDate } from "../../lib/format";
import { Card, IconTile, SectionHeading, Segmented, TextLink } from "../../components/studio";
import { useElementWidth } from "../../lib/useElementWidth";

type Point = ProgressOverview["timeline"][number];

const RANGES = [
  { value: "all", label: "All time" },
  { value: "90", label: "90 days" },
  { value: "30", label: "30 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

const LEFT = 36;
const TOP = 16;
const BOTTOM = 204;
const HEIGHT = 236;

export function ChartEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-input bg-background px-6 py-10 text-center">
      <IconTile>
        <ChartNoAxesCombined className="size-6" aria-hidden="true" />
      </IconTile>
      <h3 className="mt-1 text-base">{title}</h3>
      <p className="max-w-[40ch] text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}

export function ProgressChart({ timeline, target }: { timeline: Point[]; target?: number }) {
  const [range, setRange] = useState<Range>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameRef, width] = useElementWidth<HTMLDivElement>(320);
  const RIGHT = width - 18;
  const sorted = [...timeline]
    .filter((p) => Number.isFinite(p.overallBand) && Number.isFinite(Date.parse(p.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const cutoff = Date.now() - Number(range) * 86400000;
  const points = range === "all" ? sorted : sorted.filter((p) => Date.parse(p.date) >= cutoff);
  const selected = points.find((p) => p.testId === selectedId) ?? points.at(-1);
  const [low, high] = bandDomain([target, ...points.map((p) => p.overallBand)]);
  const ticks = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const x = (index: number) => (points.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + (index * (RIGHT - LEFT)) / (points.length - 1));
  const y = (band: number) => BOTTOM - ((Math.max(low, Math.min(high, band)) - low) / (high - low)) * (BOTTOM - TOP);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.overallBand!)}`).join(" ");

  return (
    <Card className="grid content-start gap-4" aria-labelledby="journey-overall-title">
      <SectionHeading
        kicker="The bigger picture"
        title="Overall band over time"
        titleId="journey-overall-title"
        action={sorted.length > 0 && <Segmented size="sm" label="Chart time range" value={range} onChange={setRange} options={RANGES.map((item) => ({ value: item.value, label: item.label }))} />}
      />
      {points.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong className="text-2xl text-foreground tabular-nums">{bandText(selected?.overallBand)}</strong>
              <span className="text-[13px] text-muted-foreground"> estimated band · {formatDate(selected?.date)}</span>
            </p>
            <span className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block size-2.5 rounded-full" style={{ background: OVERALL_COLOR }} aria-hidden="true" /> Overall band
              </span>
              {target !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <i className="legend-dash" aria-hidden="true" /> Target {bandText(target)}
                </span>
              )}
            </span>
          </div>
          <div className="relative w-full min-w-0 overflow-hidden contain-inline-size" ref={frameRef}>
            <svg
              className="block w-full"
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width={width}
              height={HEIGHT}
              role="group"
              aria-label={`Overall band across ${points.length} attempts, from ${bandText(points[0].overallBand)} to ${bandText(points.at(-1)?.overallBand)}. Exact values are in the all tests table.`}
            >
              {ticks.map((band) => (
                <g key={band}>
                  <line className="chart-grid" x1={LEFT} x2={RIGHT} y1={y(band)} y2={y(band)} />
                  <text className="chart-tick" x={LEFT - 12} y={y(band) + 4} textAnchor="end">
                    {band}
                  </text>
                </g>
              ))}
              {target !== undefined && <line className="chart-target" x1={LEFT} x2={RIGHT} y1={y(target)} y2={y(target)} />}
              {points.length > 1 && (
                <>
                  <path d={`${path} L${x(points.length - 1)},${BOTTOM} L${LEFT},${BOTTOM} Z`} fill={OVERALL_COLOR} fillOpacity=".06" />
                  <path d={path} stroke={OVERALL_COLOR} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                </>
              )}
              {points.map((p, i) => (
                <g key={p.testId}>
                  <circle className="chart-dot" cx={x(i)} cy={y(p.overallBand!)} r={selected?.testId === p.testId ? 7 : 5} fill={OVERALL_COLOR} />
                  <circle
                    cx={x(i)}
                    cy={y(p.overallBand!)}
                    r="16"
                    fill="transparent"
                    className="chart-point"
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatDate(p.date)}, band ${bandText(p.overallBand)}`}
                    onMouseEnter={() => setSelectedId(p.testId)}
                    onFocus={() => setSelectedId(p.testId)}
                    onClick={() => setSelectedId(p.testId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(p.testId);
                      }
                    }}
                  />
                </g>
              ))}
              <text className="chart-tick" x={LEFT} y={BOTTOM + 24}>
                {formatDate(points[0].date)}
              </text>
              {points.length > 1 && (
                <text className="chart-tick" x={RIGHT} y={BOTTOM + 24} textAnchor="end">
                  {formatDate(points.at(-1)?.date)}
                </text>
              )}
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">
              {points.length === 1 ? "Your baseline is set. A second scored test will show a trend." : "Hover or focus a point to explore. Tests are spaced evenly."}
            </span>
            {selected && (
              <TextLink to={`/reports/${selected.reportId}`} size="sm">
                Open this report
              </TextLink>
            )}
          </div>
        </>
      ) : (
        <ChartEmpty title={sorted.length ? "No tests in this period" : "Every journey starts somewhere"}>
          {sorted.length ? "Choose a longer time range to see your results." : "Complete your first speaking test to set your baseline. Your real scores will appear here."}
        </ChartEmpty>
      )}
    </Card>
  );
}
