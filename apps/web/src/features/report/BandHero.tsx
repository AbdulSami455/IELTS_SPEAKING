import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { CSSProperties } from "react";
import { api, type Report } from "../../lib/api";
import { bandText, formatDate } from "../../lib/format";
import { Alert, Badge, Button } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";

export function BandHero({ report }: { report: Report }) {
  const navigate = useNavigate();
  const [reassessing, setReassessing] = useState(false);
  async function reassess() {
    setReassessing(true);
    setError(null);
    try {
      const result = await api.reassessReport(report.reportId);
      navigate(`/tests/${result.testId}/processing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reassess report");
    } finally { setReassessing(false); }
  }
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(
        err instanceof Error
          ? err.message
          : "Could not download your report. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  const band = report.isInconclusive ? undefined : report.overallBand;
  return (
    <section className="report-hero card">
      <div
        className="score-ring"
        style={{ "--score": ((band ?? 0) / 9) * 100 } as CSSProperties}
      >
        <div>
          <span className="band-display">{bandText(band)}</span>
          <span className="caption">THIS TEST’S BAND</span>
          <span className="caption">out of 9.0</span>
        </div>
      </div>
      <div className="stack">
        <div className="row">
          <Badge tone="accent">{report.confidenceLabel} confidence</Badge>
          {report.isInconclusive && <Badge>Inconclusive</Badge>}
          <span className="caption">{formatDate(report.createdAt)}</span>
        </div>
        <h2>
          {report.isInconclusive
            ? "Let’s get a clearer picture."
            : "Your result for this test"}
        </h2>
        <p>
          {report.isInconclusive
            ? "There wasn’t enough reliable evidence for an overall band. Review the feedback below before your next attempt."
            : "This band uses only this test. Your progress page separately summarises your recent scored tests."}
        </p>
        {report.isInconclusive && (
          <div className="stack-sm">
            <p><strong>One usable test is enough.</strong> Completing more tests is not a requirement to unlock a band.</p>
            <ul className="list">{report.scoreReadiness?.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <Button variant="secondary" onClick={reassess} loading={reassessing}>Reassess saved recordings</Button>
          </div>
        )}
        <p className="caption">{report.disclaimer}</p>
        <div className="row no-print">
          <Button
            variant="primary"
            size="sm"
            onClick={exportReport}
            loading={exporting}
          >
            <Icon name="download" size={16} />
            Download report
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </section>
  );
}
