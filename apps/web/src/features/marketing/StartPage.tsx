import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Mic } from "lucide-react";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, IconTile } from "../../components/studio";
import { MarketingShell } from "./MarketingShell";

const CHECKLIST = [
  {
    title: "Find your quiet corner.",
    body: "Bring a working microphone and allow access when prompted. Headphones help keep the sound clear.",
  },
  {
    title: "Give yourself a little time.",
    body: "Set aside 11–14 minutes for the three parts. Listen to each question, then answer naturally, out loud.",
  },
  {
    title: "Leave with a next step.",
    body: "After scoring, your report brings together a practice band estimate, feedback, and a personal practice plan.",
  },
];

export function StartPage() {
  useDocumentTitle("Start a speaking test");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(() => {
        if (!cancelled) setSignedIn(true);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-[1160px] px-5 md:px-10">
        <header className="grid max-w-[640px] gap-5 py-14 md:py-20">
          <p className="kicker">Before your first conversation</p>
          <h1 className="text-[clamp(36px,4.6vw,56px)] leading-[1.06] [&_em]:text-coral">
            A little preparation.
            <br />
            <em>Then, just be yourself.</em>
          </h1>
          <p className="text-lg text-subtle">
            You don’t need a perfect answer. You need a place to start. Here’s how to get comfortable before you speak.
          </p>
        </header>
        <section className="grid items-start gap-8 pb-20 lg:grid-cols-[1.2fr_1fr]" aria-label="Prepare for your practice">
          <ol className="grid gap-4">
            {CHECKLIST.map((item, index) => (
              <li key={item.title} className="flex gap-5 rounded-lg border border-border bg-card p-6">
                <span className="font-mono text-sm text-coral" aria-hidden="true">
                  0{index + 1}
                </span>
                <div className="grid gap-1.5">
                  <h2 className="text-xl">{item.title}</h2>
                  <p className="text-sm text-subtle">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="grid gap-4 rounded-lg border border-border bg-blush p-6 md:p-8">
            <IconTile className="bg-card">
              <Mic className="size-6" aria-hidden="true" />
            </IconTile>
            <h2 className="text-2xl">Your studio is waiting.</h2>
            <p className="text-sm text-subtle">
              {signedIn
                ? "Head to your practice overview to start a new test or pick up where you left off."
                : "Create an account to keep your tests, feedback, and progress together in one place. Free during beta."}
            </p>
            <Button size="lg" className="w-full" to={signedIn ? "/" : "/login?mode=register"}>
              {signedIn ? "Open your studio" : "Create your account"} <ArrowRight />
            </Button>
            {!signedIn && (
              <p className="text-[13px] text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" state={{ from: "/" }} className="font-medium text-foreground">
                  Sign in
                </Link>
              </p>
            )}
            <ul className="grid gap-2 border-t border-border pt-4 text-[13px] text-subtle">
              <li className="inline-flex items-center gap-2">
                <Clock className="size-4 text-primary" aria-hidden="true" /> 11–14 minutes
              </li>
              <li className="inline-flex items-center gap-2">
                <Mic className="size-4 text-primary" aria-hidden="true" /> Microphone needed
              </li>
            </ul>
          </aside>
        </section>
      </div>
    </MarketingShell>
  );
}
