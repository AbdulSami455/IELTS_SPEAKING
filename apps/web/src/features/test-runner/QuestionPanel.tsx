import { useState } from "react";
import type { TestSession, Turn } from "../../lib/api";
import { Badge } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";

export function QuestionPanel({
  test,
  turn,
}: {
  test: TestSession;
  turn?: Turn;
}) {
  const [tab, setTab] = useState("questions");
  const answered = test.turns.filter((item) =>
    ["VALID", "READY"].includes(item.answerStatus),
  );
  // Only reveal questions already asked, plus the current question.
  const visible = test.turns.filter(
    (item) =>
      item.id === turn?.id || answered.some((answer) => answer.id === item.id),
  );
  if (turn && !visible.some((item) => item.id === turn.id)) visible.push(turn);
  const ordered = [...visible].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <aside className="question-panel card stack" aria-label="Session companion">
      <div className="row between">
        <div>
          <p className="kicker">Alongside your conversation</p>
          <h2>Session companion</h2>
        </div>
        <Icon name="book" />
      </div>
      <div className="segmented panel-tabs" aria-label="Companion view">
        {[
          { id: "questions", label: "Q&A", icon: "message" as const },
          { id: "guide", label: "Session guide", icon: "book" as const },
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </div>
      {tab === "questions" ? (
        <>
          <div className="row between">
            <span className="caption">Your conversation</span>
            <Badge tone="accent">{answered.length} answered</Badge>
          </div>
          <div className="conversation-feed">
            {ordered.length === 0 ? (
              <div className="empty">
                Your examiner’s questions will appear here as you go.
              </div>
            ) : (
              ordered.map((item, index) => (
                <details
                  className={`conversation-turn${item.id === turn?.id ? " current" : ""}`}
                  key={`${item.id}-${item.id === turn?.id}`}
                  open={item.id === turn?.id}
                >
                  <summary>
                    <span className="question-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      Part {item.part}
                      {item.isFollowUp ? " · Follow-up" : " · Question"}
                      <small>
                        {item.id === turn?.id
                          ? "Current question"
                          : "Answer saved"}
                      </small>
                    </span>
                    <span className="caption">⌄</span>
                  </summary>
                  <div className="stack turn-content">
                    <div className="chat-message examiner">
                      <span className="kicker">AI examiner</span>
                      <p>{item.promptText}</p>
                    </div>
                    {item.cueCard && (
                      <div className="cue-card stack-sm">
                        <strong>{item.cueCard.title}</strong>
                        <ul className="list">
                          {item.cueCard.prompts?.map((prompt) => (
                            <li key={prompt}>{prompt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="chat-message candidate">
                      <span className="kicker">You</span>
                      <p>
                        {item.transcriptText ||
                          (item.id === turn?.id
                            ? "Your answer belongs here. Speak naturally when you’re ready."
                            : "Recording saved. Your transcript will appear when it’s available.")}
                      </p>
                    </div>
                  </div>
                </details>
              ))
            )}
          </div>
          <div className="companion-note">
            <Icon name="spark" size={17} />
            <p>
              Corrections, scoring, and a practice plan arrive in your report
              after the session.
            </p>
          </div>
        </>
      ) : (
        <div className="stack session-guide">
          <div>
            <Badge tone="accent">01 · Interview</Badge>
            <h3>Start with the everyday.</h3>
            <p>
              Answer questions about familiar topics. Share a reason or a detail
              to develop your ideas.
            </p>
          </div>
          <div>
            <Badge tone="accent">02 · Long turn</Badge>
            <h3>A moment to gather your thoughts.</h3>
            <p>
              Use the preparation minute to organise your cue card response.
              Follow the on-screen timer.
            </p>
          </div>
          <div>
            <Badge tone="accent">03 · Discussion</Badge>
            <h3>Take the idea further.</h3>
            <p>
              Explain your view, compare perspectives, and support your answers
              with examples.
            </p>
          </div>
          <div className="companion-note">
            <Icon name="mic" />
            <p>
              Answers save after a longer pause. You can pause the microphone
              using the controls below the examiner.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
