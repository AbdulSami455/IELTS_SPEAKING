import { useId, useState } from "react";
import { Link } from "react-router-dom";
import type { ProgressOverview } from "../../lib/api";
import { bandText, formatDate } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";

type Point = ProgressOverview["timeline"][number];
export function ProgressChart({
  timeline,
  target,
  compact = false,
}: {
  timeline: Point[];
  target?: number;
  compact?: boolean;
}) {
  const gradient = useId();
  const [range, setRange] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = [...timeline]
    .filter(
      (p) =>
        Number.isFinite(p.overallBand) && Number.isFinite(Date.parse(p.date)),
    )
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const cutoff = Date.now() - Number(range) * 86400000;
  const points =
    range === "all"
      ? sorted
      : sorted.filter((p) => Date.parse(p.date) >= cutoff);
  const selected = points.find((p) => p.testId === selectedId) ?? points.at(-1);
  const left = 38,
    right = 640,
    top = 28,
    bottom = 210;
  const x = (index: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (points.length - 1);
  const y = (band: number) =>
    bottom - (Math.max(0, Math.min(9, band)) / 9) * (bottom - top);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.overallBand!)}`)
    .join(" ");
  return (
    <section
      className="card chart-card stack"
      aria-label="Band score improvement"
    >
      <div className="row between">
        <div>
          <p className="kicker">The bigger picture</p>
          <h2>Your speaking journey</h2>
        </div>
        {!compact && (
          <label className="chart-range">
            <span className="visually-hidden">Chart time range</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        )}
        {compact && (
          <Link className="text-link" to="/progress">
            View progress <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
      {points.length ? (
        <>
          <div className="row between chart-summary">
            <p>
              <strong>{bandText(selected?.overallBand)}</strong>
              <span className="caption">
                {" "}
                estimated band · {formatDate(selected?.date)}
              </span>
            </p>
            <span className="chart-legend">
              <i /> Overall band{" "}
              {target !== undefined && <span>┄ Target {bandText(target)}</span>}
            </span>
          </div>
          <svg
            className="band-chart"
            viewBox="0 0 670 245"
            role="img"
            aria-label={`Overall band across ${points.length} attempts, from ${bandText(points[0].overallBand)} to ${bandText(points.at(-1)?.overallBand)}. Exact values are available below.`}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#139e91" stopOpacity=".18" />
                <stop offset="100%" stopColor="#139e91" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 3, 6, 9].map((band) => (
              <g key={band}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(band)}
                  y2={y(band)}
                  stroke="#e5eceb"
                  strokeDasharray="3 5"
                />
                <text x="12" y={y(band) + 4}>
                  {band}
                </text>
              </g>
            ))}
            {target !== undefined && (
              <line
                x1={left}
                x2={right}
                y1={y(target)}
                y2={y(target)}
                stroke="#9c7d36"
                strokeDasharray="6 5"
              />
            )}
            {points.length > 1 && (
              <>
                <path
                  d={`${path} L${x(points.length - 1)},${bottom} L${left},${bottom} Z`}
                  fill={`url(#${gradient})`}
                />
                <path
                  d={path}
                  stroke="#10897e"
                  strokeWidth="3"
                  fill="none"
                  strokeLinejoin="round"
                />
              </>
            )}
            {points.map((p, i) => (
              <g key={p.testId}>
                <circle
                  cx={x(i)}
                  cy={y(p.overallBand!)}
                  r={selected?.testId === p.testId ? 7 : 5}
                  fill="#10897e"
                  stroke="white"
                  strokeWidth="3"
                />
                <circle
                  cx={x(i)}
                  cy={y(p.overallBand!)}
                  r="14"
                  fill="transparent"
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
            <text x={left} y="238">
              {formatDate(points[0].date)}
            </text>
            {points.length > 1 && (
              <text x={right} y="238" textAnchor="end">
                {formatDate(points.at(-1)?.date)}
              </text>
            )}
          </svg>
          <div className="row between">
            <span className="caption">
              {points.length === 1
                ? "Your baseline is set. A second scored attempt will show a trend."
                : "Hover or focus a point to explore. Attempts are spaced equally."}
            </span>
            {selected && (
              <Link className="text-link" to={`/reports/${selected.reportId}`}>
                Open report <Icon name="arrow" size={15} />
              </Link>
            )}
          </div>
          {!compact && (
            <details className="chart-data">
              <summary>View chart data</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Attempt date</th>
                      <th>Estimated band</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.testId}>
                        <td>{formatDate(p.date)}</td>
                        <td>{bandText(p.overallBand)}</td>
                        <td>
                          <Link to={`/reports/${p.reportId}`}>View report</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="chart-empty">
          <span className="icon-tile">
            <Icon name="chart" size={26} />
          </span>
          <h3>
            {sorted.length
              ? "No attempts in this period"
              : "Every journey starts somewhere"}
          </h3>
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
