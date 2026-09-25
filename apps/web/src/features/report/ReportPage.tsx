import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Report } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button, LoadingState } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
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
  { id: "summary", label: "Summary" },
  { id: "skills", label: "Skills" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "fluency", label: "Fluency" },
  { id: "pronunciation", label: "Pronunciation" },
  { id: "corrections", label: "Corrections" },
  { id: "rewrites", label: "Better answers" },
  { id: "transcript", label: "Transcript" },
  { id: "practice", label: "Practice plan" },
] as const;

// Highlights the last section whose top has scrolled past the sticky nav.
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const nav = document.querySelector(".report-nav");
      const line = (nav?.getBoundingClientRect().bottom ?? 120) + 24;
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top === undefined || top > line) continue;
        // Side-by-side sections share a top; prefer the one just navigated to.
        if (top > bestTop + 1 || (Math.abs(top - bestTop) <= 1 && window.location.hash === `#${id}`)) {
          best = id;
          bestTop = top;
        }
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(atBottom && best ? ids[ids.length - 1] : best);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

export function ReportPage() {
  const { reportId, testId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState<string[]>([]);
  const active = useActiveSection(present);
  useDocumentTitle(report ? `Speaking report · ${formatDate(report.createdAt)}` : "Speaking report");

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
            throw new Error("This report isn’t available yet. Check the session status or try again shortly.");
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
  }, [reportId, testId, revision]);

  // Sections render only when the report has data for them, so the nav
  // lists whatever actually made it onto the page.
  useLayoutEffect(() => {
    if (!report) return;
    setPresent(NAV.filter((item) => document.getElementById(item.id)).map((item) => item.id));
  }, [report]);

  if (error) {
    return (
      <AppShell>
        <div className="report-page stack-lg">
          <ReportTopBar />
          <Alert
            tone="error"
            title="We couldn’t open this report"
            action={
              <Button size="sm" variant="secondary" onClick={() => setRevision((n) => n + 1)}>
                Try again
              </Button>
            }
          >
            {error}
          </Alert>
          <div className="row">
            {testId && (
              <Link to={`/tests/${testId}/processing`} className="btn btn--secondary">
                Check scoring status
              </Link>
            )}
            <Link to="/" className="btn btn--ghost">
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
        <div className="report-page stack-lg">
          <ReportTopBar />
          <div className="center-page">
            <LoadingState label="Opening your report…" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="stack-lg report-page">
        <ReportTopBar />
        <div className="page-heading row between">
          <div className="stack-sm">
            <p className="kicker">Speaking report · {formatDate(report.createdAt)}</p>
            <h1>Your speaking report</h1>
          </div>
          <Link to="/progress" className="btn btn--secondary no-print">
            View my progress <Icon name="arrow" size={16} />
          </Link>
        </div>
        <BandHero report={report} />
        {present.length > 1 && (
          <nav className="report-nav no-print" aria-label="Report sections">
            {NAV.filter((item) => present.includes(item.id)).map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={active === item.id ? "active" : undefined}
                aria-current={active === item.id ? "location" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div id="summary" className="stack-lg">
          <ProgressComparisonSection report={report} />
          <InsightPair report={report} />
        </div>
        <section id="skills" className="stack" aria-labelledby="skills-heading">
          <div className="section-head">
            <h2 id="skills-heading">The skills behind your score</h2>
            <p className="caption">The four IELTS speaking criteria, with evidence from this test.</p>
          </div>
          <CriterionGrid criteria={report.criteria} />
        </section>
        <VocabularySection report={report} />
        <div className="report-delivery-grid">
          <FluencySection report={report} />
          <PronunciationSection report={report} />
        </div>
        <MistakesSection report={report} />
        <RewritesSection report={report} />
        <TranscriptsSection report={report} />
        <PracticePlanSection report={report} />
        <details className="methodology caption">
          <summary>
            Report methodology <Icon name="chevronDown" size={16} />
          </summary>
          <p>
            Evaluator {report.evaluatorVersion} · Rubric {report.rubricVersion} · Policy {report.modelPolicyVersion}
          </p>
        </details>
      </div>
    </AppShell>
  );
}
