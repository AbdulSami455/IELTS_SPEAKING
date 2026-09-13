import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Report } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { Alert } from "../../components/ui";
import { BandHero } from "./BandHero";
import { CriterionGrid } from "./CriterionGrid";
import { ReportTopBar } from "./ReportTopBar";
import {
  FluencySection,
  InsightPair,
  MistakesSection,
  PracticePlanSection,
  ProgressComparisonSection,
  PronunciationSection,
  RewritesSection,
  TranscriptsSection,
  VocabularySection,
} from "./ReportSections";

const NAV = [
  { href: "#skills", label: "Skills" },
  { href: "#vocabulary", label: "Vocabulary" },
  { href: "#fluency", label: "Fluency" },
  { href: "#pronunciation", label: "Pronunciation" },
  { href: "#corrections", label: "Corrections" },
  { href: "#transcript", label: "Transcript" },
  { href: "#practice", label: "Plan" },
] as const;

export function ReportPage() {
  const { reportId, testId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
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
          } else {
            throw new Error(
              "This report is not available yet. Check the session status or try again shortly.",
            );
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load report",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId, testId, revision]);

  if (error) {
    return (
      <AppShell>
        <ReportTopBar />
        <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
          <Alert tone="error">{error}</Alert>
          <div className="row">
            <button
              className="btn btn--primary"
              onClick={() => setRevision((n) => n + 1)}
            >
              Try again
            </button>
            <Link to="/" className="btn btn--secondary">
              Back to overview
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell>
        <ReportTopBar />
        <div className="center-page">
          <p>Opening your report…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="stack-lg report-page">
        <ReportTopBar />
        <div className="page-heading row between wrap-gap">
          <div className="stack-sm">
            <p className="kicker">Results & feedback</p>
            <h1>Your speaking report</h1>
            <p className="muted caption">
              Scroll by section — vocabulary, fluency, pronunciation, and fixes are separated so you
              can focus on one thing at a time.
            </p>
          </div>
          <Link to="/progress" className="btn btn--secondary">
            View my progress →
          </Link>
        </div>
        <BandHero report={report} />
        <nav className="report-nav no-print" aria-label="Report sections">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <div id="overview" className="stack-lg">
          <ProgressComparisonSection report={report} />
          <InsightPair report={report} />
        </div>
        <div id="skills" className="stack">
          <div className="section-head">
            <h2>The skills behind your score</h2>
            <p className="caption">
              Four perspectives on your speaking, with evidence from this attempt.
            </p>
          </div>
          <CriterionGrid criteria={report.criteria} />
        </div>
        <VocabularySection report={report} />
        <div className="report-delivery-grid">
          <FluencySection report={report} />
          <PronunciationSection report={report} />
        </div>
        <div className="stack-lg">
          <MistakesSection report={report} />
          <RewritesSection report={report} />
        </div>
        <TranscriptsSection report={report} />
        <div id="practice">
          <PracticePlanSection report={report} />
        </div>
        <details className="caption">
          <summary>Report methodology</summary>
          <p>
            Evaluator {report.evaluatorVersion} · Rubric {report.rubricVersion}{" "}
            · Policy {report.modelPolicyVersion}
          </p>
        </details>
      </div>
    </AppShell>
  );
}
