import type { CriterionScore } from "../../lib/api";
import { criterionColor } from "../../lib/criteria";
import { confidenceText, criterionLabel, humanize } from "../../lib/format";
import { Meter } from "../../components/studio";

export function CriterionGrid({ criteria }: { criteria: CriterionScore[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {criteria.map((item) => {
        const color = criterionColor(item.criterion);
        return (
          <article
            key={item.criterion}
            className="relative grid content-start gap-3 overflow-hidden rounded-lg border border-border bg-card px-5 pt-6 pb-5"
            aria-label={`${criterionLabel(item.criterion)}: ${item.band == null ? "no band" : `band ${item.band.toFixed(1)}`}`}
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} data-print-color aria-hidden="true" />
            <h3 className="text-[13px] font-semibold text-subtle sm:min-h-[2.6em]">{criterionLabel(item.criterion)}</h3>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-[44px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {item.band == null ? "—" : item.band.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">{confidenceText(item.confidence)}</span>
            </div>
            {item.band != null && <Meter value={item.band} label={criterionLabel(item.criterion)} color={color} />}
            {item.subdimensions.length > 0 && (
              <dl className="grid gap-1 text-[13px]">
                {item.subdimensions.map((sub) => (
                  <div key={sub.key} className="flex justify-between gap-2 border-b border-dashed border-border py-1">
                    <dt className="text-muted-foreground">{humanize(sub.key)}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">{sub.band?.toFixed?.(1) ?? sub.band}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.evidence && item.evidence.length > 0 && (
              <div className="grid gap-2 text-[13px]">
                {item.evidence.map((evidence, index) => (
                  <div key={index} className="grid gap-1.5">
                    {evidence.quote && (
                      <blockquote className="border-l-[3px] border-input pl-3 text-foreground italic">“{evidence.quote}”</blockquote>
                    )}
                    {evidence.note && <p className="text-muted-foreground">{evidence.note}</p>}
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
