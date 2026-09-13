import type { ReactNode } from "react";
import type { Report } from "../../lib/api";
import { bandText, formatDate, humanize } from "../../lib/format";
import { Badge } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";

function ReportSectionShell({
  id,
  icon,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  icon: "book" | "spark" | "volume" | "message";
  kicker: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="report-section card stack">
      <header className="report-section-head">
        <span className="report-section-icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <div className="stack-sm">
          <p className="kicker">{kicker}</p>
          <h2>{title}</h2>
          {lead && <p className="muted">{lead}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function MetricTiles({
  items,
}: {
  items: { label: string; value: string; status?: string; hint?: string }[];
}) {
  if (!items.length) return null;
  return (
    <div className="insight-metrics">
      {items.map((item) => (
        <div
          key={item.label}
          className={`insight-metric insight-metric--${item.status ?? "good"}`}
        >
          <span className="caption">{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint && <p className="caption">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

const MISTAKE_GROUPS = [
  { key: "grammar", label: "Grammar" },
  { key: "phrase", label: "Phrase choice" },
  { key: "sentence_completion", label: "Sentence completion" },
  { key: "fluency", label: "Fluency" },
] as const;

type MistakeGroup = {
  key: string;
  label: string;
  items: NonNullable<Report["mistakes"]>;
};

function groupMistakes(report: Report): MistakeGroup[] {
  const mistakes = report.mistakes ?? [];
  const grouped = new Map<string, typeof mistakes>();
  for (const item of mistakes) {
    const key = (item.type ?? "issue").toLowerCase();
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  const ordered: MistakeGroup[] = MISTAKE_GROUPS
    .filter((group) => grouped.has(group.key))
    .map((group) => ({ ...group, items: grouped.get(group.key) ?? [] }));
  for (const [key, items] of grouped.entries()) {
    if (!MISTAKE_GROUPS.some((group) => group.key === key)) {
      ordered.push({ key, label: humanize(key), items });
    }
  }
  return ordered;
}

export function ProgressComparisonSection({ report }: { report: Report }) {
  const comparison = report.progressComparison;
  const minorFromTest = report.minorImprovements ?? [];
  const minorFromTrends = comparison?.minorGains ?? [];
  const minorItems = [...minorFromTest, ...minorFromTrends.filter((item) => !minorFromTest.includes(item))];
  if (!comparison?.hasPrevious && minorFromTest.length === 0) return null;

  return (
    <section className="card stack comparison-panel">
      <div className="section-head">
        <h2>Compared with your last test</h2>
        <p className="caption">
          {comparison?.hasPrevious && comparison.previousTestAt
            ? `Previous scored test: ${formatDate(comparison.previousTestAt)}.`
            : "Complete another test to unlock side-by-side progress."}
        </p>
      </div>
      {comparison?.hasPrevious && (
        <div className="comparison-grid">
          {(comparison.improvedAreas ?? []).length > 0 && (
            <div className="comparison-block comparison-block--up">
              <h3>What improved</h3>
              <ul className="list">
                {(comparison.improvedAreas ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {minorItems.length > 0 && (
            <div className="comparison-block comparison-block--minor">
              <h3>Minor improvements</h3>
              <ul className="list">
                {minorItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {(comparison.stillWorkingOn ?? []).length > 0 && (
            <div className="comparison-block comparison-block--focus">
              <h3>Still working on</h3>
              <ul className="list">
                {(comparison.stillWorkingOn ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {comparison?.mistakeTrends && comparison.hasPrevious && (
        <div className="stack-sm">
          {(comparison.mistakeTrends.resolved?.length ?? 0) > 0 && (
            <p className="caption">
              <strong>Resolved since last test:</strong>{" "}
              {comparison.mistakeTrends.resolved.map((item) => humanize(item.type ?? "issue")).join(", ")}
            </p>
          )}
          {(comparison.mistakeTrends.newIssues?.length ?? 0) > 0 && (
            <p className="caption">
              <strong>New this test:</strong>{" "}
              {comparison.mistakeTrends.newIssues.map((item) => humanize(item.type ?? "issue")).join(", ")}
            </p>
          )}
        </div>
      )}
      {!comparison?.hasPrevious && minorFromTest.length > 0 && (
        <div className="comparison-block comparison-block--minor">
          <h3>Small wins in this test</h3>
          <ul className="list">
            {minorFromTest.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

export function InsightPair({ report }: { report: Report }) {
  return (
    <div className="grid-2">
      <section className="card">
        <div className="section-head">
          <h2>Strengths in this test</h2>
        </div>
        <ul className="list">
          {report.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <div className="section-head">
          <h2>Priority focus for next time</h2>
          <p className="caption">Highest-impact changes to practise before your next attempt.</p>
        </div>
        <ul className="list">
          {report.improvements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function MistakesSection({ report }: { report: Report }) {
  const groups = groupMistakes(report);
  if (groups.length === 0) return null;
  const trends = report.progressComparison?.mistakeTrends;
  return (
    <section id="corrections" className="card stack report-section">
      <div className="section-head">
        <h2>Corrections from your transcript</h2>
        <p className="caption">
          Grouped by issue type with the rule, correction, and a short drill for each.
        </p>
      </div>
      {trends && report.progressComparison?.hasPrevious && (
        <div className="mistake-trend-row">
          {(trends.resolved?.length ?? 0) > 0 && <span className="pill pill--good">{trends.resolved.length} resolved</span>}
          {(trends.recurring?.length ?? 0) > 0 && <span className="pill pill--warn">{trends.recurring.length} recurring</span>}
          {(trends.newIssues?.length ?? 0) > 0 && <span className="pill">{trends.newIssues.length} new</span>}
        </div>
      )}
      <div className="mistake-groups">
        {groups.map((group) => (
          <div key={group.key} className="mistake-group stack-sm">
            <h3>{group.label}</h3>
            <ul className="list list--neutral">
              {group.items.map((item, index) => (
                <li key={`${group.key}-${index}`} className="stack-sm">
                  {item.quote && <div className="quote">“{item.quote}”</div>}
                  {item.correction && (
                    <p>
                      <strong>Correction: </strong>{item.correction}
                    </p>
                  )}
                  {item.note && <p className="muted"><strong>Rule: </strong>{item.note}</p>}
                  {item.practice && <p><strong>Drill: </strong>{item.practice}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RewritesSection({ report }: { report: Report }) {
  if (report.exampleRewrites.length === 0) return null;
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Same idea. A stronger answer.</h2>
        <p className="caption">
          Examples that keep your meaning — not model answers.
        </p>
      </div>
      <ul className="list list--neutral">
        {report.exampleRewrites.map((item, index) => (
          <li key={index} className="stack-sm">
            <div className="rewrite-original">
              <span className="kicker">You said</span>
              <p>{item.original}</p>
            </div>
            <div className="rewrite-improved">
              <span className="kicker">Try this</span>
              <p>{item.saferRewrite}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VocabularySection({ report }: { report: Report }) {
  const data = report.vocabularyInsights;
  const hasLegacy = (report.transcripts?.length ?? 0) > 0;
  if (!data?.hasContent && !hasLegacy) return null;

  return (
    <ReportSectionShell
      id="vocabulary"
      icon="book"
      kicker="Lexical resource"
      title="Words you used & how to level up"
      lead="A readable snapshot of your vocabulary in this test — not a word list dump."
    >
      {data?.stats && data.stats.length > 0 && <MetricTiles items={data.stats} />}
      {(data?.wordsYouUsed?.length ?? 0) > 0 && (
        <div className="insight-block stack-sm">
          <h3>Notable words from your answers</h3>
          <p className="caption">
            Content words you used (excluding very common fillers). Stronger answers often mix
            everyday and topic-specific vocabulary.
          </p>
          <div className="word-chip-grid">
            {data!.wordsYouUsed.map((word) => (
              <span key={word} className="word-chip">{word}</span>
            ))}
          </div>
        </div>
      )}
      {(data?.lexicalHighlights?.length ?? 0) > 0 && (
        <div className="insight-block stack-sm">
          <h3>What worked well</h3>
          <ul className="insight-cards">
            {data!.lexicalHighlights.map((item, index) => (
              <li key={index} className="insight-card">
                {item.quote && <div className="quote">“{item.quote}”</div>}
                {item.note && <p>{item.note}</p>}
                {item.practice && <p className="caption"><strong>Try: </strong>{item.practice}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(data?.phraseFixes?.length ?? 0) > 0 && (
        <div className="insight-block stack-sm">
          <h3>Phrase & word choice fixes</h3>
          <ul className="insight-cards">
            {data!.phraseFixes.map((item, index) => (
              <li key={index} className="insight-card insight-card--focus">
                {item.quote && <div className="quote">“{item.quote}”</div>}
                {item.correction && <p><strong>Say: </strong>{item.correction}</p>}
                {item.note && <p className="muted">{item.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(data?.coachingTips?.length ?? 0) > 0 && (
        <div className="insight-callout">
          <h3>What to improve next</h3>
          <ul className="list">
            {data!.coachingTips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </div>
      )}
      {!data && hasLegacy && (
        <p className="muted caption">
          Reassess this test with the current evaluator to unlock structured vocabulary feedback.
        </p>
      )}
    </ReportSectionShell>
  );
}

export function FluencySection({ report }: { report: Report }) {
  const data = report.fluencyInsights;
  const legacy = report.fluency ?? [];
  if (!data && legacy.length === 0) return null;

  const metrics = data?.metrics ?? [];
  const observations =
    data?.observations ??
    legacy.map((body) => ({
      kind: "coach",
      title: "Fluency note",
      body,
      quote: undefined as string | undefined,
    }));

  return (
    <ReportSectionShell
      id="fluency"
      icon="spark"
      kicker="Fluency & coherence"
      title="How your delivery felt"
      lead="Pace, pauses, and coherence — tied to audio and your fluency band."
    >
      {data?.band != null && (
        <p className="fluency-band-line">
          Fluency band this test: <strong>{bandText(data.band)}</strong>
          {data.confidence && <span className="caption"> · {data.confidence} confidence</span>}
        </p>
      )}
      <MetricTiles items={metrics} />
      {observations.length > 0 && (
        <div className="insight-block stack-sm">
          <h3>Observations</h3>
          <ul className="insight-cards">
            {observations.map((item, index) => (
              <li key={index} className="insight-card">
                <span className="caption insight-card-label">{item.title}</span>
                {item.quote && <div className="quote">“{item.quote}”</div>}
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(data?.focusNext?.length ?? 0) > 0 && (
        <div className="insight-callout insight-callout--focus">
          <h3>Focus before your next test</h3>
          <ul className="list">
            {data!.focusNext.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </ReportSectionShell>
  );
}

export function TranscriptsSection({ report }: { report: Report }) {
  if (!report.transcripts || report.transcripts.length === 0) return null;
  const highlight: string[] = (report.mistakes
    ?.map((m) => m.quote)
    .filter(Boolean) ?? []) as string[];
  function highlightText(text: string) {
    if (!highlight.length) return <p>{text}</p>;
    const parts = text.split(
      new RegExp(
        `(${highlight
          .map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .filter(Boolean)
          .join("|")})`,
        "gi",
      ),
    );
    return (
      <p>
        {parts.map((part, index) =>
          highlight.some(
            (q) => q !== undefined && q.toLowerCase() === part.toLowerCase(),
          ) ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          ),
        )}
      </p>
    );
  }
  return (
    <ReportSectionShell
      id="transcript"
      icon="message"
      kicker="Full transcript"
      title="Your conversation, in words"
      lead="Corrections are highlighted. Read alongside vocabulary and fluency sections above."
    >
      <div className="transcript-stack">
        {report.transcripts.map((item, index) => (
          <article key={index} className="transcript-part stack-sm">
            <Badge tone="accent">Part {item.part}</Badge>
            <p className="transcript-prompt">{item.promptText}</p>
            <div className="transcript-answer">{highlightText(item.text)}</div>
          </article>
        ))}
      </div>
    </ReportSectionShell>
  );
}

export function PronunciationSection({ report }: { report: Report }) {
  const data = report.pronunciationInsights;
  const legacy = report.pronunciation ?? [];
  if (!data && legacy.length === 0) return null;

  const practiceWords = data?.practiceWords ?? legacy.flatMap((p) => p.unclearWords ?? []);
  const improvements = data?.improvements ?? [];

  return (
    <ReportSectionShell
      id="pronunciation"
      icon="volume"
      kicker="Pronunciation & clarity"
      title="Sounds, pace, and words to practise"
      lead={data?.disclaimer ?? "Clarity and rhythm feedback from your recording. Accent is not an error."}
    >
      {data?.accentNote && (
        <div className="insight-callout insight-callout--warn">
          <p>{data.accentNote}</p>
        </div>
      )}
      {practiceWords.length > 0 && (
        <div className="insight-block stack-sm">
          <h3>Words to practise for clearer delivery</h3>
          <p className="caption">
            These were harder for the speech recogniser to catch — often stress or consonant clarity,
            not “wrong accent”.
          </p>
          <div className="word-chip-grid word-chip-grid--practice">
            {practiceWords.map((word) => (
              <span key={word} className="word-chip word-chip--practice">{word}</span>
            ))}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div className="insight-block stack-sm">
          <h3>What to improve</h3>
          <ul className="pronunciation-actions">
            {improvements.map((item) => (
              <li key={item.title} className="pronunciation-action">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <p className="caption action-step"><strong>Action: </strong>{item.action}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(data?.findings?.length ?? 0) > 0 && (
        <div className="insight-block stack-sm">
          <h3>Checker findings</h3>
          <ul className="list">
            {data!.findings.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
      {(data?.notes?.length ?? 0) > 0 && (
        <div className="insight-block stack-sm">
          <h3>Notes</h3>
          <ul className="list list--neutral">
            {data!.notes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
      {!data && legacy.length > 0 && (
        <p className="caption muted">
          Open this report again after reassessment for clearer pronunciation guidance.
        </p>
      )}
    </ReportSectionShell>
  );
}

export function PracticePlanSection({ report }: { report: Report }) {
  const days = report.practicePlan.days ?? [];
  if (days.length === 0) return null;
  const focusAreas = [
    ...(report.progressComparison?.stillWorkingOn ?? []).slice(0, 2),
    ...report.improvements.slice(0, 2),
  ];
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Seven-day practice plan</h2>
        <p className="caption">
          Built from this test’s corrections
          {report.progressComparison?.hasPrevious ? " and what changed since your last attempt" : ""}.
        </p>
      </div>
      {focusAreas.length > 0 && (
        <p className="caption plan-focus">
          <strong>Plan focus:</strong> {focusAreas.join(" · ")}
        </p>
      )}
      <ul className="list list--neutral practice-plan-grid">
        {days.map((day) => (
          <li key={day.day}>
            <strong>Day {day.day}</strong>
            {day.focus ? ` · ${humanize(day.focus)}` : ""}
            {day.minutes && <span className="caption"> · {day.minutes} min</span>}
            <p>{day.task}</p>
            {day.successCriteria && <p className="muted"><strong>Success check: </strong>{day.successCriteria}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
