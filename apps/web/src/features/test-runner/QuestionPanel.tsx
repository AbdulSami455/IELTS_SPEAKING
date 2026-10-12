import { BookOpen, ChevronDown, MessageSquare, Mic, Sparkles } from "lucide-react";
import type { TestSession, Turn } from "../../lib/api";
import { Badge, EmptyState } from "../../components/studio";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const GUIDE = [
  { badge: "01 · Interview", title: "Start with the everyday.", body: "Answer questions about familiar topics. Share a reason or a detail to develop your ideas." },
  { badge: "02 · Long turn", title: "A moment to gather your thoughts.", body: "Use the preparation minute to organise your cue card response. Follow the on-screen timer." },
  { badge: "03 · Discussion", title: "Take the idea further.", body: "Explain your view, compare perspectives, and support your answers with examples." },
];

export function QuestionPanel({ test, turn }: { test: TestSession; turn?: Turn }) {
  const answered = test.turns.filter((item) => ["VALID", "READY"].includes(item.answerStatus));
  // Only reveal questions already asked, plus the current question.
  const visible = test.turns.filter((item) => item.id === turn?.id || answered.some((answer) => answer.id === item.id));
  if (turn && !visible.some((item) => item.id === turn.id)) visible.push(turn);
  const ordered = [...visible].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Tabs defaultValue="questions" className="gap-4" aria-label="Session companion">
      <TabsList className="h-10 w-full">
        <TabsTrigger value="questions" className="text-[13px]">
          <MessageSquare className="size-4" /> Questions &amp; answers
        </TabsTrigger>
        <TabsTrigger value="guide" className="text-[13px]">
          <BookOpen className="size-4" /> Guide to each part
        </TabsTrigger>
      </TabsList>
      <TabsContent value="questions" className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted-foreground">Your conversation</span>
          <Badge tone="accent">{answered.length} answered</Badge>
        </div>
        <div className="grid max-h-[560px] gap-2.5 overflow-y-auto pr-1">
          {ordered.length === 0 ? (
            <EmptyState>Your examiner’s questions will appear here as you go.</EmptyState>
          ) : (
            ordered.map((item, index) => {
              const current = item.id === turn?.id;
              return (
                <Collapsible
                  key={`${item.id}-${current}`}
                  defaultOpen={current}
                  className={cn("overflow-hidden rounded-lg border border-border", current && "border-indigo-vivid/40")}
                >
                  <CollapsibleTrigger className={cn("group flex w-full items-center gap-3 px-3.5 py-3 text-left text-sm font-semibold text-foreground", current && "bg-indigo-soft")}>
                    <span className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs text-subtle tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      Part {item.part}
                      {item.isFollowUp ? " · Follow-up" : " · Question"}
                      <small className="text-xs font-normal text-muted-foreground">{current ? "Current question" : "Answer saved"}</small>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-3 p-3.5">
                      <div className="grid gap-1">
                        <span className="kicker">AI examiner</span>
                        <p className="text-sm leading-relaxed break-words">{item.promptText}</p>
                      </div>
                      {item.cueCard && (
                        <div className="grid gap-2 rounded-lg border border-gold/30 bg-gold-soft/60 px-4 py-3 text-sm">
                          <strong>{item.cueCard.title}</strong>
                          <ul className="list-disc pl-5 text-subtle">
                            {item.cueCard.prompts?.map((prompt) => (
                              <li key={prompt}>{prompt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="grid gap-1 rounded-lg bg-background px-3.5 py-3">
                        <span className="kicker">You</span>
                        <p className="text-sm leading-relaxed break-words">
                          {item.transcriptText ||
                            (current
                              ? "Your answer belongs here. Speak naturally when you’re ready."
                              : "Recording saved. Your transcript will appear when it’s available.")}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
        <p className="flex gap-2.5 border-t border-border pt-3.5 text-[13px] text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          Corrections, scoring, and a practice plan arrive in your report after the session.
        </p>
      </TabsContent>
      <TabsContent value="guide" className="grid gap-5">
        {GUIDE.map((item) => (
          <div key={item.badge} className="grid gap-2">
            <Badge tone="accent" className="justify-self-start">
              {item.badge}
            </Badge>
            <h3>{item.title}</h3>
            <p className="text-sm text-subtle">{item.body}</p>
          </div>
        ))}
        <p className="flex gap-2.5 border-t border-border pt-3.5 text-[13px] text-muted-foreground">
          <Mic className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          Answers save after a longer pause or when you press Done speaking. Use Pause mic whenever you need a moment.
        </p>
      </TabsContent>
    </Tabs>
  );
}
