import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Report } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button } from "../../components/ui";
import { BandHero } from "./BandHero";
import { CriterionGrid } from "./CriterionGrid";
import {
  FluencySection,
  InsightPair,
  MistakesSection,
  PracticePlanSection,
  PronunciationSection,
  RewritesSection,
  TranscriptsSection,
} from "./ReportSections";

export function ReportPage() {
  const { reportId, testId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (reportId) {
          const data = await api.report(reportId);
          if (!cancelled) setReport(data);
          return;
        }
        if (testId) {
          const test = await api.getTest(testId);
          if (test.reportId) {
            const data = await api.report(test.reportId);
            if (!cancelled) setReport(data);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load report");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId, testId]);

  if (error) {
    return (
      <AppShell>
        <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
          <Alert tone="error">{error}</Alert>
          <Link to="/">
            <Button variant="secondary">Back to studio</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell>
        <div className="center-page">
          <p>Opening your report…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="stack-lg">
        <BandHero report={report} />
        <CriterionGrid criteria={report.criteria} />
        <InsightPair report={report} />
        <MistakesSection report={report} />
        <RewritesSection report={report} />
        <FluencySection report={report} />
        <TranscriptsSection report={report} />
        <PronunciationSection report={report} />
        <PracticePlanSection report={report} />
      </div>
    </AppShell>
  );
}
