import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ExamHistoryOverview } from "../../lib/api/types";
import { bandText, criterionLabel, formatDate } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";

const SERIES = [
  { key: "overall", label: "Overall", color: "#10897e", field: "overallBand" as const },
  { key: "fluency_and_coherence", label: "Fluency", color: "#1aa89a", field: "criteria" as const },
  { key: "lexical_resource", label: "Vocabulary", color: "#3d7ea6", field: "criteria" as const },
  {
    key: "grammatical_range_and_accuracy",
    label: "Grammar",
    color: "#9c7d36",
    field: "criteria" as const,
  },
  { key: "pronunciation", label: "Pronunciation", color: "#7a5c9e", field: "criteria" as const },
] as const;

function bandForExam(
  exam: ExamHistoryOverview["exams"][number],
  seriesKey: string,
): number | undefined {
  if (seriesKey === "overall") return exam.overallBand;
  return exam.criteria?.[seriesKey];
}

function deltaText(delta: number) {
  if (delta > 0) return `+${bandText(delta)}`;
  if (delta < 0) return bandText(delta);
  return "No change";
}

export function ExamJourneyChart({ examHistory }: { examHistory: ExamHistoryOverview }) {
  const exams = examHistory.exams ?? [];
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SERIES.map((s) => [s.key, true])),
  );
  const activeSeries = SERIES.filter((s) => visible[s.key]);
  const left = 44;
  const right = 640;
  const top = 36;
  const bottom = 220;
  const x = (index: number) =>
    exams.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (exams.length - 1);
  const y = (band: number) =>
    bottom - (Math.max(0, Math.min(9, band)) / 9) * (bottom - top);

  const paths = useMemo(() => {
    return activeSeries.map((series) => {
      const points = exams
        .map((exam, i) => {
          const band = bandForExam(exam, series.key);
          if (band === undefined) return null;
          return { i, band };
        })
        .filter(Boolean) as { i: number; band: number }[];
      const d = points
        .map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i)},${y(p.band)}`)
        .join(" ");
      return { series, points, d };
    });
  }, [activeSeries, exams]);

  const journey = examHistory.journey;

  if (!exams.length) {
    return (
      <section className="card chart-card stack exam-journey-card" aria-label="Exam skill trends">
        <p className="kicker">Every exam at a glance</p>
        <h2>Skill trends across tests</h2>
        <div className="chart-empty">
          <span className="icon-tile">
            <Icon name="chart" size={26} />
          </span>
          <h3>Complete a scored test to unlock this chart</h3>
          <p>Each line tracks fluency, vocabulary, grammar, pronunciation, and your overall band.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card chart-card stack exam-journey-card" aria-label="Exam skill trends">
      <div className="row between wrap-gap">
        <div>
          <p className="kicker">Every exam at a glance</p>
          <h2>Skill trends across tests</h2>
          <p className="muted caption">
            {examHistory.scoredExamCount} scored test{examHistory.scoredExamCount === 1 ? "" : "s"}
            {examHistory.lifetimeOverallBand != null && (
              <>
                {" "}
                · Lifetime overall estimate{" "}
                <strong>{bandText(examHistory.lifetimeOverallBand)}</strong>
              </>
            )}
          </p>
        </div>
        <Link className="text-link" to="/progress">
          Full progress plan <Icon name="arrow" size={16} />
        </Link>
      </div>

      <div className="exam-series-legend" role="group" aria-label="Toggle chart lines">
        {SERIES.map((series) => (
          <button
            key={series.key}
            type="button"
            className={`series-pill${visible[series.key] ? " on" : ""}`}
            aria-pressed={visible[series.key]}
            onClick={() =>
              setVisible((prev) => ({ ...prev, [series.key]: !prev[series.key] }))
            }
          >
            <i style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </button>
        ))}
      </div>

      <svg
        className="band-chart exam-skills-chart"
        viewBox="0 0 670 250"
        role="img"
        aria-label={`Skill bands across ${exams.length} exams`}
      >
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
            <text x="14" y={y(band) + 4}>
              {band}
            </text>
          </g>
        ))}
        {paths.map(({ series, points, d }) =>
          points.length > 1 ? (
            <path
              key={series.key}
              d={d}
              stroke={series.color}
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
              opacity={0.92}
            />
          ) : null,
        )}
        {paths.map(({ series, points }) =>
          points.map((p) => (
            <circle
              key={`${series.key}-${p.i}`}
              cx={x(p.i)}
              cy={y(p.band)}
              r="4.5"
              fill={series.color}
              stroke="white"
              strokeWidth="2"
            />
          )),
        )}
        {exams.map((exam, i) => (
          <text
            key={exam.testId}
            x={x(i)}
            y="242"
            textAnchor="middle"
            className="exam-axis-label"
          >
            {exam.label}
          </text>
        ))}
      </svg>

      {journey && (
        <div className="journey-insight stack-sm">
          <h3>First test → latest test</h3>
          <p>
            From <strong>{journey.fromLabel}</strong> ({bandText(journey.firstOverallBand)}) to{" "}
            <strong>{journey.toLabel}</strong> ({bandText(journey.lastOverallBand)}): overall{" "}
            <span
              className={
                journey.overallDelta > 0
                  ? "delta-up"
                  : journey.overallDelta < 0
                    ? "delta-down"
                    : "delta-flat"
              }
            >
              {deltaText(journey.overallDelta)}
            </span>
            . Use this to see where practice is paying off and what still needs work.
          </p>
          <ul className="journey-deltas">
            {journey.criteria.map((item) => (
              <li key={item.criterion}>
                <span>{criterionLabel(item.criterion)}</span>
                <span>
                  {bandText(item.firstBand)} → {bandText(item.lastBand)}
                </span>
                <span
                  className={
                    item.delta > 0 ? "delta-up" : item.delta < 0 ? "delta-down" : "delta-flat"
                  }
                >
                  {deltaText(item.delta)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="chart-data" open>
        <summary>All tests & band scores</summary>
        <div className="table-scroll">
          <table className="exam-score-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Date</th>
                <th>Overall</th>
                {SERIES.slice(1).map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.testId}>
                  <td>{exam.label}</td>
                  <td>{formatDate(exam.date)}</td>
                  <td>{bandText(exam.overallBand)}</td>
                  {SERIES.slice(1).map((s) => (
                    <td key={s.key}>{bandText(exam.criteria?.[s.key])}</td>
                  ))}
                  <td>
                    <Link to={`/reports/${exam.reportId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
