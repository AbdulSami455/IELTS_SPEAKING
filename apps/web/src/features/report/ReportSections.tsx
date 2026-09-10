import type { Report } from "../../lib/api";
import { formatDate, humanize } from "../../lib/format";
import { Badge } from "../../components/ui";

const MISTAKE_GROUPS = [
  { key: "grammar", label: "Grammar" },
  { key: "phrase", label: "Phrase choice" },
  { key: "sentence_completion", label: "Sentence completion" },
  { key: "fluency", label: "Fluency" },
] as const;

function groupMistakes(report: Report) {
  const mistakes = report.mistakes ?? [];
  const grouped = new Map<string, typeof mistakes>();
  for (const item of mistakes) {
    const key = (item.type ?? "issue").toLowerCase();
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  const ordered = MISTAKE_GROUPS
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
    <section className="card stack">
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

export function FluencySection({ report }: { report: Report }) {
  if (!report.fluency || report.fluency.length === 0) return null;
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Fluency from the audio</h2>
      </div>
      <ul className="list">
        {report.fluency.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
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
    <section className="card stack">
      <div className="section-head">
        <h2>Your conversation, in words</h2>
      </div>
      {report.transcripts.map((item, index) => (
        <div key={index} className="stack-sm">
          <div className="row">
            <Badge tone="accent">Part {item.part}</Badge>
          </div>
          <p className="muted">{item.promptText}</p>
          {highlightText(item.text)}
        </div>
      ))}
    </section>
  );
}

export function PronunciationSection({ report }: { report: Report }) {
  if (!report.pronunciation || report.pronunciation.length === 0) return null;
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Pronunciation</h2>
        <p className="caption">
          Pace and recording feedback come from audio measurements. Specific sound, stress, and intonation mistakes cannot be reliably identified by the current checker. Accent is not an error.
        </p>
      </div>
      {report.pronunciation.map((item, index) => (
        <div key={index} className="stack-sm">
          <div className="chips">
            {item.coverage !== undefined && (
              <span className="pill">Coverage {item.coverage.toFixed(2)}</span>
            )}
            {item.wordsPerMinute !== undefined && (
              <span className="pill">{item.wordsPerMinute} wpm</span>
            )}
            {item.confidence && <span className="pill">{item.confidence}</span>}
          </div>
          {(item.unclearWords ?? []).length > 0 && (
            <p>
              <span className="caption">Uncertain recognition (not confirmed pronunciation mistakes): </span>
              {(item.unclearWords ?? []).join(", ")}
            </p>
          )}
          {item.modelNotes?.findings && item.modelNotes.findings.length > 0 && (
            <ul className="list">
              {item.modelNotes.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          )}
          {item.modelNotes?.notes && item.modelNotes.notes.length > 0 && (
            <ul className="list list--neutral">
              {item.modelNotes.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
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
