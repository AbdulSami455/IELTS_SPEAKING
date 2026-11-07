import { ArrowRight, BookOpen, Check, ChevronDown, Clock, MessageSquareText, Mic, type LucideIcon } from "lucide-react";
import { Button } from "../../components/studio";
import { FeedbackIllustration, StudioIllustration } from "../../components/studio/StudioIllustration";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { MarketingShell } from "./MarketingShell";
import { Link } from "react-router-dom";

const STEPS: { n: string; icon: LucideIcon; title: string; body: string; detail: string }[] = [
  {
    n: "01",
    icon: Mic,
    title: "Make yourself heard.",
    body: "Find a quiet spot and check your microphone. Your own speaking studio, wherever you are.",
    detail: "A quick sound check",
  },
  {
    n: "02",
    icon: MessageSquareText,
    title: "Have the conversation.",
    body: "Speak with an AI examiner through all three parts, from familiar questions to a deeper discussion.",
    detail: "One complete practice test",
  },
  {
    n: "03",
    icon: BookOpen,
    title: "Know what comes next.",
    body: "Get an estimated band, feedback on your answers, and a clear plan for your next attempt.",
    detail: "Feedback made for you",
  },
];

const SKILLS = [
  { title: "Fluency & coherence", body: "Keep your ideas flowing and connected." },
  { title: "Vocabulary", body: "Find the right words for what you mean." },
  { title: "Grammar", body: "Build clearer, more varied sentences." },
  { title: "Pronunciation", body: "Make every word easier to understand." },
];

const CONTAINER = "mx-auto w-full max-w-[1160px] px-5 md:px-10";

export function LandingPage() {
  useDocumentTitle("IELTS speaking practice");
  return (
    <MarketingShell>
      <section className={`${CONTAINER} grid items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:py-20`} aria-labelledby="hero-heading">
        <div className="grid gap-6">
          <p className="kicker inline-flex items-center gap-2">
            <span className="inline-block h-px w-6 bg-coral" aria-hidden="true" /> A little practice goes a long way
          </p>
          <h1 id="hero-heading" className="text-[clamp(40px,5.4vw,68px)] leading-[1.04] [&_em]:text-coral">
            Your voice.
            <br />
            Your next chapter.
            <br />
            <em>Start speaking.</em>
          </h1>
          <p className="max-w-[52ch] text-lg text-subtle">
            Feel more prepared for IELTS. Practise a full speaking test with an AI examiner and turn personal feedback into your next step
            forward.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Button size="lg" to="/start">
              Find your starting point <ArrowRight />
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground no-underline hover:underline"
            >
              How it works <ChevronDown className="size-4" aria-hidden="true" />
            </a>
          </div>
          <p className="inline-flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" /> 11–14 minutes <span aria-hidden="true">/</span> Just you, a
            microphone, and a little focus.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[460px]">
          <StudioIllustration />
        </div>
      </section>

      <div className="bg-primary text-primary-foreground" aria-label="Your practice session">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-10 gap-y-4 py-7 text-sm`}>
          <p className="mr-auto font-serif text-lg leading-snug">
            One conversation.
            <br />
            <strong className="font-semibold text-inherit">The whole experience.</strong>
          </p>
          <span className="inline-flex items-center gap-2">
            <b className="font-mono text-coral">01</b> Interview
          </span>
          <span className="inline-flex items-center gap-2">
            <b className="font-mono text-coral">02</b> Long turn
          </span>
          <span className="inline-flex items-center gap-2">
            <b className="font-mono text-coral">03</b> Discussion
          </span>
          <span className="inline-flex items-center gap-2">
            <BookOpen className="size-5 text-coral" aria-hidden="true" /> Your personal report
          </span>
        </div>
      </div>

      <section className={`${CONTAINER} grid gap-10 py-16 md:py-24`} id="how-it-works" aria-labelledby="how-heading">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-2">
            <p className="kicker">A simple rhythm</p>
            <h2 id="how-heading" className="text-[clamp(30px,3.6vw,44px)] leading-[1.1]">
              Speak. Reflect. Try again.
            </h2>
          </div>
          <p className="max-w-[34ch] text-subtle">
            Less wondering where to begin.
            <br />
            More practice that moves you forward.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.n} className="grid content-start gap-3 rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-coral">{step.n}</span>
                  <Icon className="size-7 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl">{step.title}</h3>
                <p className="text-sm text-subtle">{step.body}</p>
                <span className="mt-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{step.detail}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-card">
        <div className={`${CONTAINER} grid items-center gap-12 py-16 md:grid-cols-[1fr_1.1fr] md:py-24`} aria-labelledby="feedback-heading">
          <div className="mx-auto w-full max-w-[420px]">
            <FeedbackIllustration />
          </div>
          <div className="grid gap-6">
            <p className="kicker">More than a number</p>
            <h2 id="feedback-heading" className="text-[clamp(30px,3.6vw,44px)] leading-[1.1] [&_em]:text-coral">
              Small insights.
              <br />
              <em>Clearer next steps.</em>
            </h2>
            <p className="max-w-[52ch] text-subtle">
              Your report looks at the four speaking skills, with examples from your own answers. See what’s working and what to practise
              next.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {SKILLS.map((skill) => (
                <li key={skill.title} className="flex gap-3">
                  <span className="mt-0.5 inline-grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  <div className="grid gap-0.5">
                    <h3 className="text-base">{skill.title}</h3>
                    <p className="text-[13px] text-muted-foreground">{skill.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/learn" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground no-underline hover:underline">
              Get to know the speaking test <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className={`${CONTAINER} py-16 md:py-24`}>
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-lg border border-border bg-blush p-8 md:p-12">
          <div className="grid gap-2">
            <p className="kicker">Your next chapter starts with a conversation</p>
            <h2 className="text-[clamp(28px,3.2vw,40px)] leading-[1.1]">Let’s hear what you have to say.</h2>
          </div>
          <Button size="lg" variant="coral" to="/start">
            Start your practice <ArrowRight />
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
