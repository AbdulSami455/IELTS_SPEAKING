import type { Report } from "../../lib/api";
import { criterionLabel, humanize } from "../../lib/format";
import { Badge } from "../../components/ui";

export function InsightPair({ report }: { report: Report }) {
  return (
    <div className="grid-2">
      <section className="card">
        <div className="section-head">
          <h2>Strengths</h2>
        </div>
        <ul className="list">
          {report.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <div className="section-head">
          <h2>Highest-value changes</h2>
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
  if (!report.mistakes || report.mistakes.length === 0) return null;
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Mistakes</h2>
        <p className="caption">Grounded in your transcript. Low-confidence items are marked as possible.</p>
      </div>
      <ul className="list list--neutral">
        {report.mistakes.map((item, index) => (
          <li key={index} className="stack-sm">
            <Badge>{criterionLabel(item.type ?? "issue")}</Badge>
            {item.quote && <div className="quote">“{item.quote}”</div>}
            {item.correction && (
              <p>
                Try: <strong>{item.correction}</strong>
              </p>
            )}
            {item.note && <p className="muted">{item.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RewritesSection({ report }: { report: Report }) {
  if (report.exampleRewrites.length === 0) return null;
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Safer rewrites</h2>
        <p className="caption">Examples that keep your meaning — not model answers.</p>
      </div>
      <ul className="list list--neutral">
        {report.exampleRewrites.map((item, index) => (
          <li key={index} className="stack-sm">
            <p className="muted">{item.original}</p>
            <p>{item.saferRewrite}</p>
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
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Transcripts</h2>
      </div>
      {report.transcripts.map((item, index) => (
        <div key={index} className="stack-sm">
          <div className="row">
            <Badge tone="accent">Part {item.part}</Badge>
          </div>
          <p className="muted">{item.promptText}</p>
          <p>{item.text}</p>
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
        <p className="caption">Accent is never treated as an error. Only acoustic evidence appears here.</p>
      </div>
      {report.pronunciation.map((item, index) => (
        <div key={index} className="stack-sm">
          <div className="chips">
            {item.coverage !== undefined && <span className="pill">Coverage {item.coverage.toFixed(2)}</span>}
            {item.wordsPerMinute !== undefined && <span className="pill">{item.wordsPerMinute} wpm</span>}
            {item.confidence && <span className="pill">{item.confidence}</span>}
          </div>
          {(item.unclearWords ?? []).length > 0 && (
            <p>
              <span className="caption">Words to revisit: </span>
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
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Seven-day practice plan</h2>
      </div>
      <ul className="list list--neutral">
        {days.map((day) => (
          <li key={day.day}>
            <strong>Day {day.day}</strong>
            {day.focus ? ` · ${humanize(day.focus)}` : ""} — {day.task}
          </li>
        ))}
      </ul>
    </section>
  );
}
