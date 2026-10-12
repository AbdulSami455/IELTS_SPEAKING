import { ArrowRight } from "lucide-react";
import { Badge, Button } from "../../components/studio";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { MarketingShell } from "./MarketingShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PARTS = [
  {
    id: "part-1",
    label: "Part 1",
    time: "4–5 minutes",
    title: "Interview",
    body: "The examiner asks short questions about familiar topics: home, study, work, daily habits. Answers are usually two to four sentences. The skill is staying specific without memorising a script.",
    practice: [
      "Answer in full sentences, then add one concrete detail.",
      "If you freeze, start with a short frame: “Most days I…”, then the example.",
      "Do not list five hobbies. Pick one and develop it.",
    ],
  },
  {
    id: "part-2",
    label: "Part 2",
    time: "3–4 minutes",
    title: "Long turn",
    body: "You receive a cue card, one minute to prepare, then speak for up to two minutes. The examiner may ask one short follow-up. Notes are allowed. The skill is covering the bullets in a connected story, not reading them back as headings.",
    practice: [
      "Use the minute to pick a real example and three beats: what, when, why it mattered.",
      "Speak past the one-minute mark. Stopping at 40 seconds is the usual gap.",
      "Link bullets with “after that”, “the reason was”, “what I remember most”.",
    ],
  },
  {
    id: "part-3",
    label: "Part 3",
    time: "4–5 minutes",
    title: "Discussion",
    body: "Questions become more abstract and stay related to the Part 2 theme: causes, comparisons, the future. The skill is giving an opinion, a reason, and a wider example — not repeating your Part 2 story.",
    practice: [
      "Answer the question type: why, compare, or what might change.",
      "One clear position is stronger than three half-ideas.",
      "If you disagree, say so and explain. Hedging every sentence sounds unfinished.",
    ],
  },
];

const BANDS = [
  {
    name: "Fluency & coherence",
    listen: "Can you keep going, and do the ideas arrive in an order a listener can follow?",
    lift: "Replace fillers with a silent pause. Plan the second sentence before you finish the first.",
  },
  {
    name: "Lexical resource",
    listen: "Do you have words for this topic, or do you repeat “good”, “thing”, and “nice”?",
    lift: "Swap one repeated adjective per answer. Learn collocations for the topic, not isolated rare words.",
  },
  {
    name: "Grammar",
    listen: "Can you use more than one tense and still be accurate when the sentence gets longer?",
    lift: "Finish the sentence you started. A complete simple sentence beats a broken complex one.",
  },
  {
    name: "Pronunciation",
    listen: "Can a listener catch the word on the first pass? Stress and rhythm matter more than accent.",
    lift: "Slow the last word of a clause. Practise unclear words in a short sentence, not in isolation only.",
  },
];

const CONTAINER = "mx-auto w-full max-w-[1160px] px-5 md:px-10";

export function LearnPage() {
  useDocumentTitle("Learn the speaking test");
  return (
    <MarketingShell>
      <header className={`${CONTAINER} grid max-w-[1160px] gap-5 py-14 md:py-20`}>
        <p className="kicker">The speaking guide</p>
        <h1 className="max-w-[640px] text-[clamp(36px,4.6vw,56px)] leading-[1.06] [&_em]:text-coral">
          A familiar format.
          <br />
          <em>A more confident you.</em>
        </h1>
        <p className="max-w-[60ch] text-lg text-subtle">
          Get to know the three parts of the IELTS speaking test, what each one asks of you, and the skills to focus on as you practise.
        </p>
      </header>

      <section className={`${CONTAINER} grid gap-8 pb-16 md:pb-24`} aria-labelledby="format-heading">
        <div className="grid gap-2">
          <p className="kicker">Format</p>
          <h2 id="format-heading" className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">
            Three parts. One continuous conversation.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PARTS.map((part) => (
            <article key={part.id} id={part.id} className="grid content-start gap-4 rounded-lg border border-border bg-card p-6">
              <header className="grid gap-2">
                <div className="flex items-center gap-3">
                  <Badge tone="dark">{part.label}</Badge>
                  <span className="text-[13px] text-muted-foreground">{part.time}</span>
                </div>
                <h3 className="text-2xl">{part.title}</h3>
              </header>
              <p className="text-sm text-subtle">{part.body}</p>
              <h4 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">In the studio, aim for this</h4>
              <ul className="grid gap-2 pl-5 text-sm text-subtle marker:text-coral">
                {part.practice.map((item) => (
                  <li key={item} className="list-disc pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-card">
        <div className={`${CONTAINER} grid gap-8 py-16 md:py-24`} aria-labelledby="bands-heading">
          <div className="grid gap-2">
            <p className="kicker">Criteria</p>
            <h2 id="bands-heading" className="text-[clamp(28px,3.4vw,40px)] leading-[1.1]">
              Four skills. Plenty of room to grow.
            </h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs text-muted-foreground">Criterion</TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">What a listener notices</TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">One change that usually helps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BANDS.map((row) => (
                  <TableRow key={row.name} className="align-top">
                    <TableCell className="px-4 py-4 font-medium whitespace-normal text-foreground">{row.name}</TableCell>
                    <TableCell className="px-4 py-4 whitespace-normal text-subtle">{row.listen}</TableCell>
                    <TableCell className="px-4 py-4 whitespace-normal text-subtle">{row.lift}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className={`${CONTAINER} py-16 md:py-24`}>
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-lg border border-border bg-blush p-8 md:p-12">
          <div className="grid gap-2">
            <p className="kicker">Put it into practice</p>
            <h2 className="text-[clamp(28px,3.2vw,40px)] leading-[1.1]">Your next step? A conversation.</h2>
          </div>
          <Button size="lg" variant="coral" to="/start">
            Start a speaking test <ArrowRight />
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
