import type { ReactNode } from "react";
import { BookOpen, CalendarDays, MessageSquareText, Sparkles, Volume2, type LucideIcon } from "lucide-react";
import type { Report } from "../../lib/api";
import { bandText, formatDate, humanize } from "../../lib/format";
import { Badge, Card, IconTile, SectionHeading } from "../../components/studio";
import { cn } from "@/lib/utils";

/** Offsets anchored sections below the sticky top bar and section nav. */
const ANCHOR = "scroll-mt-[calc(var(--topbar-h)+72px)]";

function ReportSection({
  id,
  icon: Icon,
  kicker,
  title,
  lead,
  children,
  className,
}: {
  id?: string;
  icon?: LucideIcon;
  kicker?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <Card id={id} className={cn("grid gap-5", id && ANCHOR, className)} aria-labelledby={titleId}>
      <header className="flex items-start gap-4">
        {Icon && (
          <IconTile>
            <Icon className="size-5" aria-hidden="true" />
          </IconTile>
        )}
        <div className="grid gap-1">
          {kicker && <p className="kicker">{kicker}</p>}
          <h2 id={titleId}>{title}</h2>
          {lead && <p className="text-[13px] text-muted-foreground">{lead}</p>}
        </div>
      </header>
      {children}
    </Card>
  );
}

function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("grid gap-2 pl-5 text-sm text-subtle marker:text-primary", className)}>
      {items.map((item) => (
        <li key={item} className="list-disc pl-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return <blockquote className="border-l-2 border-coral pl-3 font-serif text-[15px] text-foreground italic">“{children}”</blockquote>;
}

function Callout({ title, tone = "info", children }: { title?: string; tone?: "info" | "focus" | "warn"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-lg p-4",
        tone === "info" && "bg-indigo-soft",
        tone === "focus" && "bg-blush",
        tone === "warn" && "bg-warning-soft",
      )}
    >
      {title && <h3 className="text-base">{title}</h3>}
      {children}
    </div>
  );
}

function InsightCard({ children, focus = false }: { children: ReactNode; focus?: boolean }) {
  return (
    <li className={cn("grid gap-2 rounded-lg border border-border bg-background p-4 text-sm", focus && "border-coral/40 bg-blush")}>
      {children}
    </li>
  );
}

function WordChip({ children, practice = false }: { children: ReactNode; practice?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-[13px] font-medium",
        practice ? "bg-warning-soft text-warning" : "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </span>
  );
}

const METRIC_TONE: Record<string, string> = {
  good: "border-success/30 bg-success-soft/60",
  strong: "border-success/30 bg-success-soft/60",
  ok: "border-border bg-background",
  neutral: "border-border bg-background",
  watch: "border-warning/30 bg-warning-soft/60",
  mixed: "border-warning/30 bg-warning-soft/60",
  warning: "border-warning/30 bg-warning-soft/60",
  poor: "border-destructive/30 bg-destructive/5",
  low: "border-destructive/30 bg-destructive/5",
  weak: "border-destructive/30 bg-destructive/5",
};

function MetricTiles({ items }: { items: { label: string; value: string; status?: string; hint?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "grid content-start gap-1 rounded-lg border p-3",
            METRIC_TONE[(item.status ?? "good").toLowerCase()] ?? METRIC_TONE.neutral,
          )}
        >
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <strong className="text-lg leading-tight text-foreground tabular-nums">{item.value}</strong>
          {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function SubHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-base">{title}</h3>
      {lead && <p className="text-[13px] text-muted-foreground">{lead}</p>}
    </div>
  );
}

const MISTAKE_GROUPS = [
  { key: "grammar", label: "Grammar" },
  { key: "phrase", label: "Phrase choice" },
  { key: "sentence_completion", label: "Sentence completion" },
  { key: "fluency", label: "Fluency" },
] as const;

type MistakeGroup = { key: string; label: string; items: NonNullable<Report["mistakes"]> };

function groupMistakes(report: Report): MistakeGroup[] {
  const mistakes = report.mistakes ?? [];
  const grouped = new Map<string, typeof mistakes>();
  for (const item of mistakes) {
    const key = (item.type ?? "issue").toLowerCase();
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  const ordered: MistakeGroup[] = MISTAKE_GROUPS.filter((group) => grouped.has(group.key)).map((group) => ({
    ...group,
    items: grouped.get(group.key) ?? [],
  }));
  for (const [key, items] of grouped.entries()) {
    if (!MISTAKE_GROUPS.some((group) => group.key === key)) ordered.push({ key, label: humanize(key), items });
  }
  return ordered;
}

function ComparisonBlock({ title, tone, items }: { title: string; tone: "up" | "minor" | "focus"; items: string[] }) {
  return (
    <div
      className={cn(
        "grid content-start gap-2 rounded-lg p-4",
        tone === "up" && "bg-success-soft",
        tone === "minor" && "bg-indigo-soft",
        tone === "focus" && "bg-blush",
      )}
    >
      <h3 className={cn("text-base", tone === "up" && "text-success")}>{title}</h3>
      <BulletList items={items} />
    </div>
  );
}

export function ProgressComparisonSection({ report }: { report: Report }) {
  const comparison = report.progressComparison;
  const minorFromTest = report.minorImprovements ?? [];
  const minorFromTrends = comparison?.minorGains ?? [];
  const minorItems = [...minorFromTest, ...minorFromTrends.filter((item) => !minorFromTest.includes(item))];
  if (!comparison?.hasPrevious && minorFromTest.length === 0) return null;

  const improved = comparison?.improvedAreas ?? [];
  const working = comparison?.stillWorkingOn ?? [];
  const trends = comparison?.mistakeTrends;

  return (
    <ReportSection
      title="Compared with your last test"
      lead={
        comparison?.hasPrevious && comparison.previousTestAt
          ? `Previous scored test: ${formatDate(comparison.previousTestAt)}.`
          : "Complete another test to unlock side-by-side progress."
      }
    >
      {comparison?.hasPrevious && (
        <div className="grid gap-3 md:grid-cols-3">
          {improved.length > 0 && <ComparisonBlock title="What improved" tone="up" items={improved} />}
          {minorItems.length > 0 && <ComparisonBlock title="Minor improvements" tone="minor" items={minorItems} />}
          {working.length > 0 && <ComparisonBlock title="Still working on" tone="focus" items={working} />}
        </div>
      )}
      {trends && comparison?.hasPrevious && ((trends.resolved?.length ?? 0) > 0 || (trends.newIssues?.length ?? 0) > 0) && (
        <div className="grid gap-1 text-[13px] text-muted-foreground">
          {(trends.resolved?.length ?? 0) > 0 && (
            <p>
              <strong className="text-foreground">Resolved since last test:</strong>{" "}
              {trends.resolved.map((item) => humanize(item.type ?? "issue")).join(", ")}
            </p>
          )}
          {(trends.newIssues?.length ?? 0) > 0 && (
            <p>
              <strong className="text-foreground">New this test:</strong>{" "}
              {trends.newIssues.map((item) => humanize(item.type ?? "issue")).join(", ")}
            </p>
          )}
        </div>
      )}
      {!comparison?.hasPrevious && minorFromTest.length > 0 && (
        <ComparisonBlock title="Small wins in this test" tone="minor" items={minorFromTest} />
      )}
    </ReportSection>
  );
}

export function InsightPair({ report }: { report: Report }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="grid content-start gap-4" aria-labelledby="strengths-title">
        <SectionHeading title="Strengths in this test" titleId="strengths-title" />
        <BulletList items={report.strengths} />
      </Card>
      <Card className="grid content-start gap-4 border-coral/40 bg-blush" aria-labelledby="focus-title">
        <SectionHeading
          title="Priority focus for next time"
          titleId="focus-title"
          lead="Highest-impact changes to practise before your next attempt."
        />
        <BulletList items={report.improvements} className="marker:text-coral" />
      </Card>
    </div>
  );
}

export function MistakesSection({ report }: { report: Report }) {
  const groups = groupMistakes(report);
  if (groups.length === 0) return null;
  const trends = report.progressComparison?.mistakeTrends;
  const showTrends = Boolean(trends && report.progressComparison?.hasPrevious);
  return (
    <ReportSection
      id="corrections"
      kicker="Grammar & accuracy"
      title="Corrections from your transcript"
      lead="Grouped by issue type with the rule, correction, and a short drill for each."
    >
      {showTrends && trends && (
        <div className="flex flex-wrap gap-2">
          {(trends.resolved?.length ?? 0) > 0 && <Badge tone="success">{trends.resolved.length} resolved</Badge>}
          {(trends.recurring?.length ?? 0) > 0 && <Badge tone="warning">{trends.recurring.length} recurring</Badge>}
          {(trends.newIssues?.length ?? 0) > 0 && <Badge>{trends.newIssues.length} new</Badge>}
        </div>
      )}
      <div className="grid gap-6">
        {groups.map((group) => (
          <div key={group.key} className="grid gap-3">
            <h3 className="text-base">{group.label}</h3>
            <ul className="grid gap-3">
              {group.items.map((item, index) => (
                <InsightCard key={`${group.key}-${index}`}>
                  {item.quote && <Quote>{item.quote}</Quote>}
                  {item.correction && (
                    <p className="text-foreground">
                      <strong>Correction: </strong>
                      {item.correction}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-muted-foreground">
                      <strong>Rule: </strong>
                      {item.note}
                    </p>
                  )}
                  {item.practice && (
                    <p className="text-subtle">
                      <strong>Drill: </strong>
                      {item.practice}
                    </p>
                  )}
                </InsightCard>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

export function RewritesSection({ report }: { report: Report }) {
  if (report.exampleRewrites.length === 0) return null;
  return (
    <ReportSection
      id="rewrites"
      kicker="Better answers"
      title="Same idea. A stronger answer."
      lead="Examples that keep your meaning — not model answers."
    >
      <ul className="grid gap-3">
        {report.exampleRewrites.map((item, index) => (
          <li key={index} className="grid overflow-hidden rounded-lg border border-border md:grid-cols-2">
            <div className="grid content-start gap-1.5 bg-background p-4 text-sm">
              <span className="kicker">You said</span>
              <p className="text-subtle">{item.original}</p>
            </div>
            <div className="grid content-start gap-1.5 bg-success-soft p-4 text-sm">
              <span className="kicker text-success">Try this</span>
              <p className="text-foreground">{item.saferRewrite}</p>
            </div>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

export function VocabularySection({ report }: { report: Report }) {
  const data = report.vocabularyInsights;
  const hasLegacy = (report.transcripts?.length ?? 0) > 0;
  if (!data?.hasContent && !hasLegacy) return null;

  return (
    <ReportSection
      id="vocabulary"
      icon={BookOpen}
      kicker="Lexical resource"
      title="Words you used & how to level up"
      lead="A readable snapshot of your vocabulary in this test — not a word list dump."
    >
      {data?.stats && data.stats.length > 0 && <MetricTiles items={data.stats} />}
      {(data?.wordsYouUsed?.length ?? 0) > 0 && (
        <div className="grid gap-3">
          <SubHeading
            title="Notable words from your answers"
            lead="Content words you used (excluding very common fillers). Stronger answers often mix everyday and topic-specific vocabulary."
          />
          <div className="flex flex-wrap gap-2">
            {data!.wordsYouUsed.map((word) => (
              <WordChip key={word}>{word}</WordChip>
            ))}
          </div>
        </div>
      )}
      {(data?.lexicalHighlights?.length ?? 0) > 0 && (
        <div className="grid gap-3">
          <SubHeading title="What worked well" />
          <ul className="grid gap-3 md:grid-cols-2">
            {data!.lexicalHighlights.map((item, index) => (
              <InsightCard key={index}>
                {item.quote && <Quote>{item.quote}</Quote>}
                {item.note && <p className="text-subtle">{item.note}</p>}
                {item.practice && (
                  <p className="text-[13px] text-muted-foreground">
                    <strong>Try: </strong>
                    {item.practice}
                  </p>
                )}
              </InsightCard>
            ))}
          </ul>
        </div>
      )}
      {(data?.phraseFixes?.length ?? 0) > 0 && (
        <div className="grid gap-3">
          <SubHeading title="Phrase & word choice fixes" />
          <ul className="grid gap-3 md:grid-cols-2">
            {data!.phraseFixes.map((item, index) => (
              <InsightCard key={index} focus>
                {item.quote && <Quote>{item.quote}</Quote>}
                {item.correction && (
                  <p className="text-foreground">
                    <strong>Say: </strong>
                    {item.correction}
                  </p>
                )}
                {item.note && <p className="text-muted-foreground">{item.note}</p>}
              </InsightCard>
            ))}
          </ul>
        </div>
      )}
      {(data?.coachingTips?.length ?? 0) > 0 && (
        <Callout title="What to improve next">
          <BulletList items={data!.coachingTips} />
        </Callout>
      )}
      {!data && hasLegacy && (
        <p className="text-[13px] text-muted-foreground">
          Reassess this test with the current evaluator to unlock structured vocabulary feedback.
        </p>
      )}
    </ReportSection>
  );
}

export function FluencySection({ report }: { report: Report }) {
  const data = report.fluencyInsights;
  const legacy = report.fluency ?? [];
  if (!data && legacy.length === 0) return null;

  const metrics = data?.metrics ?? [];
  const observations =
    data?.observations ?? legacy.map((body) => ({ kind: "coach", title: "Fluency note", body, quote: undefined as string | undefined }));

  return (
    <ReportSection
      id="fluency"
      icon={Sparkles}
      kicker="Fluency & coherence"
      title="How your delivery felt"
      lead="Pace, pauses, and coherence — tied to audio and your fluency band."
    >
      {data?.band != null && (
        <p className="text-sm text-subtle">
          Fluency band this test: <strong className="text-foreground">{bandText(data.band)}</strong>
          {data.confidence && <span className="text-[13px] text-muted-foreground"> · {data.confidence} confidence</span>}
        </p>
      )}
      <MetricTiles items={metrics} />
      {observations.length > 0 && (
        <div className="grid gap-3">
          <SubHeading title="Observations" />
          <ul className="grid gap-3">
            {observations.map((item, index) => (
              <InsightCard key={index}>
                <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{item.title}</span>
                {item.quote && <Quote>{item.quote}</Quote>}
                <p className="text-subtle">{item.body}</p>
              </InsightCard>
            ))}
          </ul>
        </div>
      )}
      {(data?.focusNext?.length ?? 0) > 0 && (
        <Callout title="Focus before your next test" tone="focus">
          <BulletList items={data!.focusNext} />
        </Callout>
      )}
    </ReportSection>
  );
}

export function TranscriptsSection({ report }: { report: Report }) {
  if (!report.transcripts || report.transcripts.length === 0) return null;
  const highlight = (report.mistakes?.map((m) => m.quote).filter(Boolean) ?? []) as string[];
  const pattern = highlight.length
    ? new RegExp(`(${highlight.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
    : null;

  function highlightText(text: string) {
    if (!pattern) return <p>{text}</p>;
    const parts = text.split(pattern);
    return (
      <p>
        {parts.map((part, index) =>
          highlight.some((q) => q.toLowerCase() === part.toLowerCase()) ? (
            <mark key={index} className="rounded-sm bg-warning-soft px-0.5 text-foreground">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </p>
    );
  }

  return (
    <ReportSection
      id="transcript"
      icon={MessageSquareText}
      kicker="Full transcript"
      title="Your conversation, in words"
      lead="Corrections are highlighted. Read alongside the vocabulary and fluency sections above."
    >
      <div className="grid gap-3">
        {report.transcripts.map((item, index) => (
          <article key={index} className="grid gap-2 rounded-lg border border-border bg-background p-4 text-sm">
            <div>
              <Badge tone="accent">Part {item.part}</Badge>
            </div>
            <p className="font-medium text-foreground">{item.promptText}</p>
            <div className="leading-relaxed text-subtle">{highlightText(item.text)}</div>
          </article>
        ))}
      </div>
    </ReportSection>
  );
}

export function PronunciationSection({ report }: { report: Report }) {
  const data = report.pronunciationInsights;
  const legacy = report.pronunciation ?? [];
  if (!data && legacy.length === 0) return null;

  const practiceWords = data?.practiceWords ?? legacy.flatMap((p) => p.unclearWords ?? []);
  const improvements = data?.improvements ?? [];

  return (
    <ReportSection
      id="pronunciation"
      icon={Volume2}
      kicker="Pronunciation & clarity"
      title="Sounds, pace, and words to practise"
      lead={data?.disclaimer ?? "Clarity and rhythm feedback from your recording. Accent is not an error."}
    >
      {data?.accentNote && (
        <Callout tone="warn">
          <p className="text-sm text-foreground">{data.accentNote}</p>
        </Callout>
      )}
      {practiceWords.length > 0 && (
        <div className="grid gap-3">
          <SubHeading
            title="Words to practise for clearer delivery"
            lead="These were harder for the speech recogniser to catch — often stress or consonant clarity, not “wrong accent”."
          />
          <div className="flex flex-wrap gap-2">
            {practiceWords.map((word) => (
              <WordChip key={word} practice>
                {word}
              </WordChip>
            ))}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div className="grid gap-3">
          <SubHeading title="What to improve" />
          <ul className="grid gap-3">
            {improvements.map((item) => (
              <InsightCard key={item.title}>
                <strong className="text-foreground">{item.title}</strong>
                <p className="text-subtle">{item.detail}</p>
                <p className="text-[13px] text-muted-foreground">
                  <strong>Action: </strong>
                  {item.action}
                </p>
              </InsightCard>
            ))}
          </ul>
        </div>
      )}
      {(data?.findings?.length ?? 0) > 0 && (
        <div className="grid gap-3">
          <SubHeading title="Checker findings" />
          <BulletList items={data!.findings} />
        </div>
      )}
      {(data?.notes?.length ?? 0) > 0 && (
        <div className="grid gap-3">
          <SubHeading title="Notes" />
          <BulletList items={data!.notes} className="marker:text-muted-foreground" />
        </div>
      )}
      {!data && legacy.length > 0 && (
        <p className="text-[13px] text-muted-foreground">Open this report again after reassessment for clearer pronunciation guidance.</p>
      )}
    </ReportSection>
  );
}

export function PracticePlanSection({ report }: { report: Report }) {
  const days = report.practicePlan.days ?? [];
  if (days.length === 0) return null;
  const focusAreas = [...(report.progressComparison?.stillWorkingOn ?? []).slice(0, 2), ...report.improvements.slice(0, 2)];
  return (
    <ReportSection
      id="practice"
      icon={CalendarDays}
      kicker="Your next week"
      title={`${days.length === 7 ? "Seven-day" : `${days.length}-day`} practice plan`}
      lead={`Built from this test’s corrections${report.progressComparison?.hasPrevious ? " and what changed since your last attempt" : ""}.`}
    >
      {focusAreas.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <strong className="text-foreground">Plan focus:</strong> {focusAreas.join(" · ")}
        </p>
      )}
      <ol className="grid gap-3 md:grid-cols-2">
        {days.map((day) => (
          <li key={day.day} className="grid content-start gap-1.5 rounded-lg border border-border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <strong className="text-foreground">Day {day.day}</strong>
              {day.focus && <span className="text-subtle">· {humanize(day.focus)}</span>}
              {day.minutes && <span className="text-[13px] text-muted-foreground">· {day.minutes} min</span>}
            </div>
            <p className="text-subtle">{day.task}</p>
            {day.successCriteria && (
              <p className="text-[13px] text-muted-foreground">
                <strong>Success check: </strong>
                {day.successCriteria}
              </p>
            )}
          </li>
        ))}
      </ol>
    </ReportSection>
  );
}
