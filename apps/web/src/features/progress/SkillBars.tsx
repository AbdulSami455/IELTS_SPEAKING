import type { ProgressOverview } from "../../lib/api";
import { criterionColor } from "../../lib/criteria";
import { bandText, criterionLabel } from "../../lib/format";
import { Meter } from "../../components/ui";

export function SkillBars({
  stats = [],
}: {
  stats?: ProgressOverview["criterionStats"];
}) {
  const scored = stats.filter((item) => item.averageBand != null);
  const weakest = scored.length > 1
    ? scored.reduce((low, item) => ((item.averageBand ?? 9) < (low.averageBand ?? 9) ? item : low))
    : undefined;

  return (
    <section className="card stack skill-card" aria-labelledby="skills-title">
      <div>
        <p className="kicker">A little better, every time</p>
        <h2 id="skills-title">Your skill balance</h2>
        <p className="caption">Average estimated band per criterion across comparable tests.</p>
      </div>
      {stats.length ? (
        <ul className="skill-bars">
          {stats.map((item) => (
            <li className="skill-bar" key={item.criterion}>
              <div className="row between">
                <span className="skill-name">
                  <i style={{ background: criterionColor(item.criterion) }} aria-hidden="true" />
                  {criterionLabel(item.criterion)}
                  {weakest?.criterion === item.criterion && <span className="pill pill--warning">Focus</span>}
                </span>
                <strong>
                  {bandText(item.averageBand)} <small>/ 9</small>
                </strong>
              </div>
              <Meter
                value={item.averageBand ?? 0}
                label={criterionLabel(item.criterion)}
                color={criterionColor(item.criterion)}
              />
              <span className="caption">
                {item.samples} scored {item.samples === 1 ? "test" : "tests"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          Your fluency, vocabulary, grammar, and pronunciation scores will appear after your first report.
        </div>
      )}
    </section>
  );
}
