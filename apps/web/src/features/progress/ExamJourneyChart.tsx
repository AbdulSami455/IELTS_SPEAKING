import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ExamHistoryOverview } from "../../lib/api/types";
import { CRITERIA, OVERALL_COLOR } from "../../lib/criteria";
import { bandDomain, bandText, criterionLabel, formatDate } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";
import { useElementWidth } from "../../lib/useElementWidth";

const SERIES = [
  { key: "overall", label: "Overall", color: OVERALL_COLOR },
  ...CRITERIA.map((item) => ({ key: item.key, label: item.short, color: item.color })),
];

type Exam = ExamHistoryOverview["exams"][number];

function bandForExam(exam: Exam, seriesKey: string): number | undefined {
  if (seriesKey === "overall") return exam.overallBand;
  return exam.criteria?.[seriesKey];
}

function deltaText(delta: number) {
  if (delta > 0) return `+${bandText(delta)}`;
  if (delta < 0) return bandText(delta);
  return "No change";
}

function deltaClass(delta: number) {
  return delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat";
}

const LEFT = 36;
const TOP = 16;
const BOTTOM = 204;
const HEIGHT = 236;

export function ExamJourneyChart({
  examHistory,
  target,
  compact = false,
}: {
  examHistory: ExamHistoryOverview;
  target?: number;
  compact?: boolean;
}) {
  const exams = examHistory.exams ?? [];
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SERIES.map((s) => [s.key, true])),
  );
  const [hovered, setHovered] = useState<number | null>(null);
  const [frameRef, width] = useElementWidth<HTMLDivElement>(670);
  const RIGHT = width - 18;

  const [low, high] = useMemo(
    () =>
      bandDomain([
        target,
        ...exams.flatMap((exam) => SERIES.map((series) => bandForExam(exam, series.key))),
      ]),
    [exams, target],
  );
  const x = (index: number) =>
    exams.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + (index * (RIGHT - LEFT)) / (exams.length - 1);
  const y = (band: number) =>
    BOTTOM - ((Math.max(low, Math.min(high, band)) - low) / (high - low)) * (BOTTOM - TOP);
  const ticks = Array.from({ length: high - low + 1 }, (_, i) => low + i);

  const paths = SERIES.filter((s) => visible[s.key]).map((series) => {
    const points = exams
      .map((exam, i) => ({ i, band: bandForExam(exam, series.key) }))
      .filter((p): p is { i: number; band: number } => p.band != null);
    const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i)},${y(p.band)}`).join(" ");
    return { series, points, d };
  });

  const journey = examHistory.journey;
  const hoveredExam = hovered !== null ? exams[hovered] : null;
  // Label every exam when there's room; otherwise just first, last, and hovered.
  const labelEvery = exams.length <= Math.max(2, Math.floor((RIGHT - LEFT) / 64) + 1);

  if (!exams.length) {
    return (
      <section className="card chart-card stack" aria-labelledby="journey-title">
        <div>
          <p className="kicker">Every exam at a glance</p>
          <h2 id="journey-title">Skill trends across tests</h2>
        </div>
        <div className="chart-empty">
          <span className="icon-tile">
            <Icon name="chart" size={24} />
          </span>
          <h3>Complete a scored test to unlock this chart</h3>
          <p>Each line tracks your overall band and the four speaking criteria, test by test.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card chart-card stack exam-journey-card" aria-labelledby="journey-title">
      <div className="row between wrap-gap">
        <div>
          <p className="kicker">Every exam at a glance</p>
          <h2 id="journey-title">Skill trends across tests</h2>
          <p className="caption">
            {examHistory.scoredExamCount} scored test{examHistory.scoredExamCount === 1 ? "" : "s"}
            {examHistory.lifetimeOverallBand != null && (
              <>
                {" "}· lifetime average <strong>{bandText(examHistory.lifetimeOverallBand)}</strong>
              </>
            )}
          </p>
        </div>
        {compact && (
          <Link className="text-link" to="/progress">
            Full progress <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>

      <div className="exam-series-legend" role="group" aria-label="Show or hide lines">
        {SERIES.map((series) => (
          <button
            key={series.key}
            type="button"
            className={`series-pill${visible[series.key] ? " on" : ""}`}
            aria-pressed={visible[series.key]}
            onClick={() => setVisible((prev) => ({ ...prev, [series.key]: !prev[series.key] }))}
          >
            <i style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </button>
        ))}
        {target !== undefined && (
          <span className="series-pill series-pill--static">
            <i className="legend-dash" aria-hidden="true" />
            Target {bandText(target)}
          </span>
        )}
      </div>

      <div className="chart-frame" ref={frameRef} onMouseLeave={() => setHovered(null)}>
        <svg
          className="band-chart"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Band scores across ${exams.length} tests. Exact values are in the table${compact ? " on the My progress page" : " below"}.`}
        >
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
          {hovered !== null && (
            <line className="chart-crosshair" x1={x(hovered)} x2={x(hovered)} y1={TOP} y2={BOTTOM} />
          )}
          {paths.map(({ series, points, d }) =>
            points.length > 1 ? (
              <path
                key={series.key}
                d={d}
                fill="none"
                stroke={series.color}
                strokeWidth={series.key === "overall" ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {paths.map(({ series, points }) =>
            points.map((p) => (
              <circle
                key={`${series.key}-${p.i}`}
                cx={x(p.i)}
                cy={y(p.band)}
                r={hovered === p.i ? 5.5 : series.key === "overall" ? 4.5 : 4}
                fill={series.color}
                className="chart-dot"
              />
            )),
          )}
          {exams.map((exam, i) => (
            <g key={exam.testId}>
              {(labelEvery || i === 0 || i === exams.length - 1 || i === hovered) && (
                <text className="chart-tick" x={x(i)} y={BOTTOM + 24} textAnchor="middle">
                  {exam.label}
                </text>
              )}
              <rect
                className="chart-hit"
                x={x(i) - Math.max(14, (RIGHT - LEFT) / Math.max(1, exams.length - 1) / 2)}
                y={TOP - 8}
                width={Math.max(28, (RIGHT - LEFT) / Math.max(1, exams.length - 1))}
                height={BOTTOM - TOP + 16}
                onMouseEnter={() => setHovered(i)}
              />
            </g>
          ))}
        </svg>
        {hoveredExam && (
          <div
            className="chart-tooltip"
            style={{ left: x(hovered!) }}
            data-edge={hovered === 0 ? "start" : hovered === exams.length - 1 ? "end" : undefined}
            role="presentation"
          >
            <strong>
              {hoveredExam.label} · {formatDate(hoveredExam.date)}
            </strong>
            {SERIES.map((series) => (
              <span key={series.key} className="chart-tooltip-row">
                <i style={{ background: series.color }} aria-hidden="true" />
                {series.label}
                <b>{bandText(bandForExam(hoveredExam, series.key))}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {!compact && journey && (
        <div className="journey-insight stack-sm">
          <h3>First test → latest test</h3>
          <p>
            From <strong>{journey.fromLabel}</strong> ({bandText(journey.firstOverallBand)}) to{" "}
            <strong>{journey.toLabel}</strong> ({bandText(journey.lastOverallBand)}): overall{" "}
            <span className={deltaClass(journey.overallDelta)}>{deltaText(journey.overallDelta)}</span>.
          </p>
          <ul className="journey-deltas">
            {journey.criteria.map((item) => (
              <li key={item.criterion}>
                <span>{criterionLabel(item.criterion)}</span>
                <span className="caption">
                  {bandText(item.firstBand)} → {bandText(item.lastBand)}
                </span>
                <span className={deltaClass(item.delta)}>{deltaText(item.delta)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <details className="chart-data" open>
          <summary>All tests &amp; band scores</summary>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Date</th>
                  {SERIES.map((s) => (
                    <th scope="col" key={s.key} className="num">
                      {s.label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="visually-hidden">Report</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.testId}>
                    <th scope="row">{exam.label}</th>
                    <td>{formatDate(exam.date)}</td>
                    {SERIES.map((s) => (
                      <td key={s.key} className="num">
                        {bandText(bandForExam(exam, s.key))}
                      </td>
                    ))}
                    <td>
                      <Link className="text-link text-link--sm" to={`/reports/${exam.reportId}`}>
                        Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
