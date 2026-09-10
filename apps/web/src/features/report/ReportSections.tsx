import type { Report } from "../../lib/api";
import { humanize } from "../../lib/format";
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
        <h2>Fine-tune your answers</h2>
        <p className="caption">
          Specific corrections from your transcript, with explanations and practice.
        </p>
      </div>
      <ul className="list list--neutral">
        {report.mistakes.map((item, index) => (
          <li key={index} className="stack-sm">
            <Badge>{humanize(item.type ?? "issue")}</Badge>
            {item.quote && <div className="quote">“{item.quote}”</div>}
            {item.correction && (
              <p>
                Try: <strong>{item.correction}</strong>
              </p>
            )}
            {item.note && <p className="muted"><strong>Why: </strong>{item.note}</p>}
            {item.practice && <p><strong>Practise: </strong>{item.practice}</p>}
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
  return (
    <section className="card stack">
      <div className="section-head">
        <h2>Seven-day practice plan</h2>
      </div>
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
