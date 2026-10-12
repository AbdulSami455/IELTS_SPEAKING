import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ExamHistoryOverview } from "../../lib/api/types";
import { CRITERIA, OVERALL_COLOR } from "../../lib/criteria";
import { bandDomain, bandText, criterionLabel, formatDate } from "../../lib/format";
import { Card, SectionHeading, TextLink } from "../../components/studio";
import { useElementWidth } from "../../lib/useElementWidth";
import { ChartEmpty } from "./ProgressChart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  return delta > 0 ? "font-semibold text-success" : delta < 0 ? "font-semibold text-destructive" : "text-muted-foreground";
}

const LEFT = 36;
const TOP = 16;
const BOTTOM = 204;
const HEIGHT = 236;

export function ExamJourneyChart({ examHistory, target, compact = false }: { examHistory: ExamHistoryOverview; target?: number; compact?: boolean }) {
  const exams = examHistory.exams ?? [];
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(SERIES.map((s) => [s.key, true])));
  const [hovered, setHovered] = useState<number | null>(null);
  const [frameRef, width] = useElementWidth<HTMLDivElement>(670);
  const RIGHT = width - 18;

  const [low, high] = useMemo(
    () => bandDomain([target, ...exams.flatMap((exam) => SERIES.map((series) => bandForExam(exam, series.key)))]),
    [exams, target],
  );
  const x = (index: number) => (exams.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + (index * (RIGHT - LEFT)) / (exams.length - 1));
  const y = (band: number) => BOTTOM - ((Math.max(low, Math.min(high, band)) - low) / (high - low)) * (BOTTOM - TOP);
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
  const edge = hovered === 0 ? "start" : hovered === exams.length - 1 ? "end" : "middle";

  if (!exams.length) {
    return (
      <Card className="grid gap-4" aria-labelledby="journey-title">
        <SectionHeading kicker="Every exam at a glance" title="Skill trends across tests" titleId="journey-title" />
        <ChartEmpty title="Complete a scored test to unlock this chart">Each line tracks your overall band and the four speaking criteria, test by test.</ChartEmpty>
      </Card>
    );
  }

  return (
    <Card className="grid gap-4" aria-labelledby="journey-title">
      <SectionHeading
        kicker="Every exam at a glance"
        title="Skill trends across tests"
        titleId="journey-title"
        lead={
          <>
            {examHistory.scoredExamCount} scored test{examHistory.scoredExamCount === 1 ? "" : "s"}
            {examHistory.lifetimeOverallBand != null && (
              <>
                {" "}
                · lifetime average <strong className="text-foreground">{bandText(examHistory.lifetimeOverallBand)}</strong>
              </>
            )}
          </>
        }
        action={
          compact && (
            <TextLink to="/progress" size="sm">
              Full progress
            </TextLink>
          )
        }
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show or hide lines">
        {SERIES.map((series) => {
          const on = visible[series.key];
          return (
            <button
              key={series.key}
              type="button"
              aria-pressed={on}
              onClick={() => setVisible((prev) => ({ ...prev, [series.key]: !prev[series.key] }))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                on ? "border-transparent bg-accent text-foreground" : "border-border bg-card text-muted-foreground line-through decoration-muted-foreground/60",
              )}
            >
              <i className={cn("inline-block size-2.5 rounded-full", !on && "opacity-30")} style={{ background: series.color }} aria-hidden="true" />
              {series.label}
            </button>
          );
        })}
        {target !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <i className="legend-dash" aria-hidden="true" />
            Target {bandText(target)}
          </span>
        )}
      </div>

      <div className="relative w-full overflow-hidden" ref={frameRef} onMouseLeave={() => setHovered(null)}>
        <svg
          className="block w-full"
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
          {target !== undefined && <line className="chart-target" x1={LEFT} x2={RIGHT} y1={y(target)} y2={y(target)} />}
          {hovered !== null && <line className="chart-crosshair" x1={x(hovered)} x2={x(hovered)} y1={TOP} y2={BOTTOM} />}
          {paths.map(({ series, points, d }) =>
            points.length > 1 ? (
              <path key={series.key} d={d} fill="none" stroke={series.color} strokeWidth={series.key === "overall" ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
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
                <text
                  className="chart-tick"
                  x={x(i)}
                  y={BOTTOM + 24}
                  textAnchor={exams.length === 1 ? "middle" : i === 0 ? "start" : i === exams.length - 1 ? "end" : "middle"}
                >
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
            className={cn(
              "pointer-events-none absolute top-2 z-10 grid min-w-[160px] gap-1 rounded-lg border border-border bg-card p-3 text-xs",
              edge === "start" ? "translate-x-0" : edge === "end" ? "-translate-x-full" : "-translate-x-1/2",
            )}
            style={{ left: x(hovered!) }}
            role="presentation"
          >
            <strong className="text-foreground">
              {hoveredExam.label} · {formatDate(hoveredExam.date)}
            </strong>
            {SERIES.map((series) => (
              <span key={series.key} className="flex items-center gap-1.5 text-muted-foreground">
                <i className="inline-block size-2 rounded-full" style={{ background: series.color }} aria-hidden="true" />
                {series.label}
                <b className="ml-auto text-foreground tabular-nums">{bandText(bandForExam(hoveredExam, series.key))}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {!compact && journey && (
        <div className="grid gap-3 rounded-lg bg-blush p-4">
          <h3 className="text-base">First test → latest test</h3>
          <p className="text-sm text-subtle">
            From <strong className="text-foreground">{journey.fromLabel}</strong> ({bandText(journey.firstOverallBand)}) to{" "}
            <strong className="text-foreground">{journey.toLabel}</strong> ({bandText(journey.lastOverallBand)}): overall{" "}
            <span className={deltaClass(journey.overallDelta)}>{deltaText(journey.overallDelta)}</span>.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {journey.criteria.map((item) => (
              <li key={item.criterion} className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm">
                <span className="text-foreground">{criterionLabel(item.criterion)}</span>
                <span className="ml-auto text-[13px] text-muted-foreground tabular-nums">
                  {bandText(item.firstBand)} → {bandText(item.lastBand)}
                </span>
                <span className={cn("min-w-14 text-right tabular-nums", deltaClass(item.delta))}>{deltaText(item.delta)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <Collapsible defaultOpen className="grid gap-3">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-foreground">
            All tests &amp; band scores <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-3 text-xs text-muted-foreground">Test</TableHead>
                    <TableHead className="px-3 text-xs text-muted-foreground">Date</TableHead>
                    {SERIES.map((s) => (
                      <TableHead key={s.key} className="px-3 text-right text-xs text-muted-foreground">
                        {s.label}
                      </TableHead>
                    ))}
                    <TableHead className="px-3">
                      <span className="sr-only">Report</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.testId}>
                      <TableCell className="px-3 py-2.5 font-medium text-foreground">{exam.label}</TableCell>
                      <TableCell className="px-3 py-2.5 text-subtle">{formatDate(exam.date)}</TableCell>
                      {SERIES.map((s) => (
                        <TableCell key={s.key} className="px-3 py-2.5 text-right text-subtle tabular-nums">
                          {bandText(bandForExam(exam, s.key))}
                        </TableCell>
                      ))}
                      <TableCell className="px-3 py-2.5 text-right">
                        <TextLink to={`/reports/${exam.reportId}`} size="sm">
                          Report
                        </TextLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
