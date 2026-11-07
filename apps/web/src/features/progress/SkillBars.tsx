import type { ProgressOverview } from "../../lib/api";
import { criterionColor } from "../../lib/criteria";
import { bandText, criterionLabel } from "../../lib/format";
import { Badge, Card, EmptyState, Meter, SectionHeading } from "../../components/studio";

export function SkillBars({ stats = [] }: { stats?: ProgressOverview["criterionStats"] }) {
  const scored = stats.filter((item) => item.averageBand != null);
  const weakest =
    scored.length > 1 ? scored.reduce((low, item) => ((item.averageBand ?? 9) < (low.averageBand ?? 9) ? item : low)) : undefined;

  return (
    <Card className="grid content-start gap-5" aria-labelledby="skills-title">
      <SectionHeading
        kicker="A little better, every time"
        title="Your skill balance"
        titleId="skills-title"
        lead="Average estimated band per criterion across comparable tests."
      />
      {stats.length ? (
        <ul className="grid gap-4">
          {stats.map((item) => (
            <li className="grid gap-1.5 text-sm" key={item.criterion}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
                  <i className="size-2 shrink-0 rounded-full" style={{ background: criterionColor(item.criterion) }} aria-hidden="true" />
                  {criterionLabel(item.criterion)}
                  {weakest?.criterion === item.criterion && <Badge tone="warning">Focus</Badge>}
                </span>
                <strong className="shrink-0 tabular-nums">
                  {bandText(item.averageBand)} <small className="text-xs font-normal text-muted-foreground">/ 9</small>
                </strong>
              </div>
              <Meter value={item.averageBand ?? 0} label={criterionLabel(item.criterion)} color={criterionColor(item.criterion)} />
              <span className="text-xs text-muted-foreground">
                {item.samples} scored {item.samples === 1 ? "test" : "tests"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Your fluency, vocabulary, grammar, and pronunciation scores will appear after your first report.</EmptyState>
      )}
    </Card>
  );
}
