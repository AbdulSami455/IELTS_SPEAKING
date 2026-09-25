import { useId, useState } from "react";
import { Link } from "react-router-dom";
import type { ProgressOverview } from "../../lib/api";
import { OVERALL_COLOR } from "../../lib/criteria";
import { bandDomain, bandText, formatDate } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";
import { useElementWidth } from "../../lib/useElementWidth";

type Point = ProgressOverview["timeline"][number];

const RANGES = [
  { id: "all", label: "All time" },
  { id: "90", label: "90 days" },
  { id: "30", label: "30 days" },
] as const;

const LEFT = 36;
const TOP = 16;
const BOTTOM = 204;
const HEIGHT = 236;

export function ProgressChart({ timeline, target }: { timeline: Point[]; target?: number }) {
  const gradient = useId();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameRef, width] = useElementWidth<HTMLDivElement>(670);
  const RIGHT = width - 18;
  const sorted = [...timeline]
    .filter((p) => Number.isFinite(p.overallBand) && Number.isFinite(Date.parse(p.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const cutoff = Date.now() - Number(range) * 86400000;
  const points = range === "all" ? sorted : sorted.filter((p) => Date.parse(p.date) >= cutoff);
  const selected = points.find((p) => p.testId === selectedId) ?? points.at(-1);
  const [low, high] = bandDomain([target, ...points.map((p) => p.overallBand)]);
  const ticks = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const x = (index: number) =>
    points.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + (index * (RIGHT - LEFT)) / (points.length - 1);
  const y = (band: number) =>
    BOTTOM - ((Math.max(low, Math.min(high, band)) - low) / (high - low)) * (BOTTOM - TOP);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.overallBand!)}`).join(" ");

  return (
    <section className="card chart-card stack" aria-labelledby="journey-overall-title">
      <div className="row between">
        <div>
          <p className="kicker">The bigger picture</p>
          <h2 id="journey-overall-title">Overall band over time</h2>
        </div>
        {sorted.length > 0 && (
          <div className="segmented segmented--sm" role="group" aria-label="Chart time range">
            {RANGES.map((item) => (
              <button key={item.id} type="button" aria-pressed={range === item.id} onClick={() => setRange(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {points.length ? (
        <>
          <div className="row between chart-summary">
            <p>
              <strong>{bandText(selected?.overallBand)}</strong>
              <span className="caption"> estimated band · {formatDate(selected?.date)}</span>
            </p>
            <span className="chart-legend">
              <span><i style={{ background: OVERALL_COLOR }} /> Overall band</span>
              {target !== undefined && (
                <span><i className="legend-dash" /> Target {bandText(target)}</span>
              )}
            </span>
          </div>
          <div className="chart-frame" ref={frameRef}>
          <svg
            className="band-chart"
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Overall band across ${points.length} attempts, from ${bandText(points[0].overallBand)} to ${bandText(points.at(-1)?.overallBand)}. Exact values are in the all tests table.`}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OVERALL_COLOR} stopOpacity=".16" />
                <stop offset="100%" stopColor={OVERALL_COLOR} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((band) => (
              <g key={band}>
                <line className="chart-grid" x1={LEFT} x2={RIGHT} y1={y(band)} y2={y(band)} />
                <text className="chart-tick" x={LEFT - 12} y={y(band) + 4} textAnchor="end">
                  {band}
                </text>
              </g>
            ))}
            {target !== undefined && (
              <line className="chart-target" x1={LEFT} x2={RIGHT} y1={y(target)} y2={y(target)} />
            )}
            {points.length > 1 && (
              <>
                <path d={`${path} L${x(points.length - 1)},${BOTTOM} L${LEFT},${BOTTOM} Z`} fill={`url(#${gradient})`} />
                <path d={path} stroke={OVERALL_COLOR} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {points.map((p, i) => (
              <g key={p.testId}>
                <circle
                  className="chart-dot"
                  cx={x(i)}
                  cy={y(p.overallBand!)}
                  r={selected?.testId === p.testId ? 7 : 5}
                  fill={OVERALL_COLOR}
                />
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
          <div className="row between">
            <span className="caption">
              {points.length === 1
                ? "Your baseline is set. A second scored test will show a trend."
                : "Hover or focus a point to explore. Tests are spaced evenly."}
            </span>
            {selected && (
              <Link className="text-link" to={`/reports/${selected.reportId}`}>
                Open this report <Icon name="arrow" size={15} />
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="chart-empty">
          <span className="icon-tile">
            <Icon name="chart" size={24} />
          </span>
          <h3>{sorted.length ? "No tests in this period" : "Every journey starts somewhere"}</h3>
          <p>
            {sorted.length
              ? "Choose a longer time range to see your results."
              : "Complete your first speaking test to set your baseline. Your real scores will appear here."}
          </p>
        </div>
      )}
    </section>
  );
}
