import { api, type Report } from "../../lib/api";
import { bandText, formatDate } from "../../lib/format";
import { Badge, Button } from "../../components/ui";

interface BandHeroProps {
  report: Report;
}

export function BandHero({ report }: BandHeroProps) {
  async function exportReport() {
    const html = await api.exportReport(report.reportId);
    const popup = window.open("", "_blank");
    if (popup) {
      popup.document.write(html);
      popup.document.close();
    }
  }

  return (
    <section className="card stack">
      <div className="row between">
        <div className="row">
          <Badge tone="accent">{report.confidenceLabel} confidence</Badge>
          {report.isInconclusive && <Badge>Inconclusive</Badge>}
        </div>
        <Button variant="secondary" size="sm" className="no-print" onClick={exportReport}>
          Export
        </Button>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 20 }}>
        <p className="band-display">{report.isInconclusive ? "—" : bandText(report.overallBand)}</p>
        <div className="stack-sm">
          <span className="caption">Estimated practice band</span>
          <span className="caption">Taken {formatDate(report.createdAt)}</span>
        </div>
      </div>
      <p className="muted">{report.disclaimer}</p>
      <p className="caption mono">
        evaluator {report.evaluatorVersion} · rubric {report.rubricVersion} · policy {report.modelPolicyVersion}
      </p>
    </section>
  );
}
