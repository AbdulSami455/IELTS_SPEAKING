import type { ProgressOverview } from "../../lib/api";
import { bandText, criterionLabel } from "../../lib/format";
import { Meter } from "../../components/ui";

export function SkillBars({
  stats = [],
}: {
  stats?: ProgressOverview["criterionStats"];
}) {
  return (
    <section className="card stack skill-card">
      <div>
        <p className="kicker">A little better, every time</p>
        <h2>Your skill balance</h2>
      </div>
      <p className="caption">
        Average estimated bands across comparable attempts.
      </p>
      {stats.length ? (
        stats.map((item, i) => (
          <div
            className={`stack-sm skill-bar skill-${i % 4}`}
            key={item.criterion}
          >
            <div className="row between">
              <span>{criterionLabel(item.criterion)}</span>
              <strong>
                {bandText(item.averageBand)} <small>/ 9</small>
              </strong>
            </div>
            <Meter
              value={item.averageBand ?? 0}
              label={criterionLabel(item.criterion)}
            />
            <span className="caption">
              {item.samples} scored{" "}
              {item.samples === 1 ? "attempt" : "attempts"}
            </span>
          </div>
        ))
      ) : (
        <div className="empty">
          Your fluency, vocabulary, grammar, and pronunciation scores will
          appear after your first report.
        </div>
      )}
    </section>
  );
}
