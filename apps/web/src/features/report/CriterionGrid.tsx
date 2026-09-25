import type { CSSProperties } from "react";
import type { CriterionScore } from "../../lib/api";
import { criterionColor } from "../../lib/criteria";
import { confidenceText, criterionLabel, humanize } from "../../lib/format";
import { Meter } from "../../components/ui";

export function CriterionGrid({ criteria }: { criteria: CriterionScore[] }) {
  return (
    <div className="criteria-grid">
      {criteria.map((item) => {
        const color = criterionColor(item.criterion);
        return (
          <article
            key={item.criterion}
            className="card stack criterion-card"
            style={{ "--crit": color } as CSSProperties}
            aria-label={`${criterionLabel(item.criterion)}: ${item.band == null ? "no band" : `band ${item.band.toFixed(1)}`}`}
          >
            <h3 className="criterion-name">{criterionLabel(item.criterion)}</h3>
            <div className="criterion-score">
              <span className="band-display">{item.band == null ? "—" : item.band.toFixed(1)}</span>
              <span className="caption">{confidenceText(item.confidence)}</span>
            </div>
            {item.band != null && <Meter value={item.band} label={criterionLabel(item.criterion)} color={color} />}
            {item.subdimensions.length > 0 && (
              <dl className="subscores">
                {item.subdimensions.map((sub) => (
                  <div key={sub.key}>
                    <dt>{humanize(sub.key)}</dt>
                    <dd>{sub.band?.toFixed?.(1) ?? sub.band}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.evidence && item.evidence.length > 0 && (
              <div className="stack-sm criterion-evidence">
                {item.evidence.map((evidence, index) => (
                  <div key={index} className="stack-sm">
                    {evidence.quote && <blockquote className="quote">“{evidence.quote}”</blockquote>}
                    {evidence.note && <p className="caption">{evidence.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
