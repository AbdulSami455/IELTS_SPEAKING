import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import type { ProgressOverview, TestListItem } from "../../lib/api";
import { CRITERIA } from "../../lib/criteria";
import { attemptStatus, bandText, formatDateTime } from "../../lib/format";
import { Badge, Button } from "../../components/studio";

export function attemptLink(test: TestListItem) {
  if (test.state === "COMPLETED") return `/reports/by-test/${test.testId}`;
  if (["CREATED", "DEVICE_CHECK"].includes(test.state)) return `/tests/${test.testId}/device-check`;
  if (["PROCESSING", "SUBMITTED", "FAILED"].includes(test.state)) return `/tests/${test.testId}/processing`;
  if (["EXPIRED", "DELETING", "DELETED", "ABANDONED"].includes(test.state)) return null;
  return `/tests/${test.testId}`;
}

export function AttemptList({
  tests,
  progress,
  deleting,
  onDelete,
}: {
  tests: TestListItem[];
  progress: ProgressOverview | null;
  deleting: string | null;
  onDelete: (test: TestListItem) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {tests.map((test) => {
        const link = attemptLink(test);
        const status = attemptStatus(test.state);
        const point = progress?.timeline.find((p) => p.testId === test.testId);
        const exam = progress?.examHistory?.exams.find((e) => e.testId === test.testId);
        const band = exam?.overallBand ?? point?.overallBand;
        const when = formatDateTime(test.createdAt) || "Date unavailable";
        return (
          <li
            key={test.testId}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5 py-4 first:pt-0 last:pb-0 lg:grid-cols-[40px_minmax(150px,1.1fr)_auto_minmax(0,1.5fr)_auto] lg:gap-x-4"
          >
            <span className="inline-grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground lg:size-10" aria-hidden="true">
              <MessageSquare className="size-[18px]" />
            </span>
            <div className="grid min-w-0">
              <strong className="text-sm">Full speaking test</strong>
              <span className="text-[13px] text-muted-foreground">{when}</span>
            </div>
            <div className="justify-self-end lg:justify-self-start">
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div className="col-span-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pl-12 lg:col-span-1 lg:pl-0">
              {band !== undefined ? (
                <>
                  <span className="inline-flex items-baseline gap-1.5">
                    <strong className="text-xl tracking-tight tabular-nums">{bandText(band)}</strong>
                    <span className="text-[13px] text-muted-foreground">overall</span>
                  </span>
                  {exam && (
                    <span className="flex flex-wrap gap-x-2.5 gap-y-1">
                      {CRITERIA.map((item) => (
                        <span key={item.key} className="inline-flex items-center gap-1 text-xs text-subtle tabular-nums" title={item.label}>
                          <i className="size-[7px] rounded-full" style={{ background: item.color }} aria-hidden="true" />
                          <abbr title={item.label} className="font-semibold text-muted-foreground">
                            {item.abbr}
                          </abbr>
                          {bandText(exam.criteria[item.key])}
                        </span>
                      ))}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[13px] text-muted-foreground">No band yet</span>
              )}
            </div>
            <div className="col-span-3 flex items-center justify-between gap-1 pl-12 lg:col-span-1 lg:justify-end lg:pl-0">
              {link ? (
                <Button variant="secondary" size="sm" to={link} className="min-w-28 max-lg:flex-1">
                  {status.action}
                </Button>
              ) : (
                <span className="text-[13px] text-muted-foreground">Closed</span>
              )}
              <button
                type="button"
                className="inline-grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                onClick={() => onDelete(test)}
                disabled={deleting !== null}
                aria-label={`Delete attempt from ${when}`}
                title="Delete attempt"
              >
                {deleting === test.testId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-[17px]" />}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
