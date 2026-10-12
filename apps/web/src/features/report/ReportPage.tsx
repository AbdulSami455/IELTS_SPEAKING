import { useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { api, type Report } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Button, LoadingState, PageHeading, SectionHeading } from "../../components/studio";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
      const nav = document.querySelector("[data-report-nav]");
      const line = (nav?.getBoundingClientRect().bottom ?? 120) + 24;
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top === undefined || top > line) continue;
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

  // Sections render only when the report has data for them, so the nav lists what's on the page.
  useLayoutEffect(() => {
    if (!report) return;
    setPresent(NAV.filter((item) => document.getElementById(item.id)).map((item) => item.id));
  }, [report]);

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto grid w-full max-w-[1000px] gap-6">
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
          <div className="flex flex-wrap gap-3">
            {testId && (
              <Button variant="secondary" to={`/tests/${testId}/processing`}>
                Check scoring status
              </Button>
            )}
            <Button variant="ghost" to="/">
              Back to overview
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell>
        <div className="mx-auto grid w-full max-w-[1000px] gap-6">
          <ReportTopBar />
          <LoadingState label="Opening your report…" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-[1000px] gap-6">
        <ReportTopBar />
        <PageHeading
          kicker={`Speaking report · ${formatDate(report.createdAt)}`}
          title="Your speaking report"
          action={
            <Button variant="secondary" to="/progress" className="no-print">
              View my progress <ArrowRight />
            </Button>
          }
        />
        <BandHero report={report} />
        {present.length > 1 && (
          <nav
            data-report-nav
            className="no-print sticky top-(--topbar-h) z-10 -mx-2 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-2 py-2 backdrop-blur [scrollbar-width:none]"
            aria-label="Report sections"
          >
            {NAV.filter((item) => present.includes(item.id)).map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-subtle no-underline transition-colors hover:bg-muted hover:text-foreground",
                  active === item.id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
                aria-current={active === item.id ? "location" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div id="summary" className="grid gap-6 scroll-mt-[calc(var(--topbar-h)+72px)]">
          <ProgressComparisonSection report={report} />
          <InsightPair report={report} />
        </div>
        <section id="skills" className="grid gap-4 scroll-mt-[calc(var(--topbar-h)+72px)]" aria-labelledby="skills-heading">
          <SectionHeading title="The skills behind your score" titleId="skills-heading" lead="The four IELTS speaking criteria, with evidence from this test." />
          <CriterionGrid criteria={report.criteria} />
        </section>
        <VocabularySection report={report} />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <FluencySection report={report} />
          <PronunciationSection report={report} />
        </div>
        <MistakesSection report={report} />
        <RewritesSection report={report} />
        <TranscriptsSection report={report} />
        <PracticePlanSection report={report} />
        <Collapsible className="text-[13px] text-muted-foreground">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 py-1 font-medium hover:text-foreground">
            Report methodology <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="pt-2">
              Evaluator {report.evaluatorVersion} · Rubric {report.rubricVersion} · Policy {report.modelPolicyVersion}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AppShell>
  );
}
