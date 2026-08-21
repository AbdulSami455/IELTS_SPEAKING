import type { CriterionScore } from "../../lib/api";
import { criterionLabel } from "../../lib/format";
import { Meter } from "../../components/ui";

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

interface CriterionGridProps {
  criteria: CriterionScore[];
}

export function CriterionGrid({ criteria }: CriterionGridProps) {
  return (
    <section className="grid" aria-label="Criterion bands">
      {criteria.map((item) => (
        <div key={item.criterion} className="card stack-sm">
          <span className="caption" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {criterionLabel(item.criterion)}
          </span>
          <p className="band-display" style={{ fontSize: "clamp(2.4rem, 5vw, 3.4rem)" }}>
            {item.band.toFixed(1)}
          </p>
          <Meter value={item.band} label={criterionLabel(item.criterion)} />
          <div className="chips">
            <span className="pill">{item.confidence}</span>
            {item.subdimensions.map((sub) => (
              <span key={sub.key} className="pill pill--accent">
                {humanize(sub.key)} · {sub.band?.toFixed?.(1) ?? sub.band}
              </span>
            ))}
          </div>
          {item.evidence && item.evidence.length > 0 && (
            <div className="stack-sm">
              {item.evidence.map((item_, index) => (
                <div key={index}>
                  {item_.quote && <div className="quote">“{item_.quote}”</div>}
                  {item_.note && <p className="muted">{item_.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
