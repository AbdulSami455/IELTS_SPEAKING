import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { CSSProperties } from "react";
import { Download, RefreshCw } from "lucide-react";
import { api, type Report } from "../../lib/api";
import { bandDescriptor, bandText, confidenceText } from "../../lib/format";
import { Alert, Badge, Button } from "../../components/studio";
import { cn } from "@/lib/utils";

export function BandHero({ report }: { report: Report }) {
  const navigate = useNavigate();
  const [reassessing, setReassessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reassess() {
    setReassessing(true);
    setError(null);
    try {
      const result = await api.reassessReport(report.reportId);
      navigate(`/tests/${result.testId}/processing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reassess report");
    } finally {
      setReassessing(false);
    }
  }

  async function exportReport() {
    setExporting(true);
    setError(null);
    try {
      const html = await api.exportReport(report.reportId);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `speaking-report-${report.reportId}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download your report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const band = report.isInconclusive ? undefined : report.overallBand;
  const descriptor = bandDescriptor(band);

  return (
    <section
      className="grid items-center gap-6 rounded-lg border border-border bg-blush p-6 text-center md:grid-cols-[200px_minmax(0,1fr)] md:gap-9 md:p-8 md:text-left"
      aria-labelledby="band-heading"
    >
      <div
        className="score-ring size-[156px] justify-self-center md:size-[188px]"
        style={{ "--score": ((band ?? 0) / 9) * 100 } as CSSProperties}
        role="img"
        aria-label={band === undefined ? "No overall band for this test" : `Overall band ${bandText(band)} out of 9`}
      >
        <div className="grid size-full place-content-center rounded-full bg-card">
          <span
            className={cn(
              "text-[50px] leading-none font-semibold tracking-tight tabular-nums md:text-[60px]",
              band === undefined ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {bandText(band)}
          </span>
          <span className="mt-1.5 text-xs font-medium text-muted-foreground">{band === undefined ? "No band" : "out of 9"}</span>
        </div>
      </div>
      <div className="grid gap-4 max-md:justify-items-center">
        <div className="flex flex-wrap gap-2 max-md:justify-center">
          {descriptor && <Badge tone="accent">{descriptor}</Badge>}
          {report.isInconclusive && <Badge tone="warning">Inconclusive</Badge>}
          <Badge>{confidenceText(report.confidenceLabel)}</Badge>
        </div>
        <h2 id="band-heading" className="text-[clamp(22px,2.6vw,28px)]">
          {report.isInconclusive ? "Let’s get a clearer picture." : `Overall band ${bandText(band)} for this test`}
        </h2>
        <p className="max-w-[62ch] text-subtle">
          {report.isInconclusive
            ? "There wasn’t enough reliable evidence for an overall band. The reasons are below — one usable test is enough, so you don’t need more tests to unlock a score."
            : "A fair practice estimate, rounded to the nearest half band. Your progress page tracks how it compares with your other tests."}
        </p>
        {report.isInconclusive && (
          <div className="grid gap-3 max-md:justify-items-center">
            {(report.scoreReadiness?.reasons.length ?? 0) > 0 && (
              <ul className="grid gap-1.5 pl-5 text-left text-sm text-subtle [list-style:disc] marker:text-indigo-vivid">
                {report.scoreReadiness?.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            <Button variant="secondary" onClick={reassess} loading={reassessing} className="justify-self-start">
              <RefreshCw /> Reassess saved recordings
            </Button>
          </div>
        )}
        <div className="no-print flex flex-wrap gap-2 max-md:justify-center">
          <Button size="sm" onClick={exportReport} loading={exporting}>
            {!exporting && <Download />}
            Download report
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-[13px] text-muted-foreground">{report.disclaimer}</p>
      </div>
    </section>
  );
}
