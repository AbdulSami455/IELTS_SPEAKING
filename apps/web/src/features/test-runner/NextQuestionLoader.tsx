import { Sparkles } from "lucide-react";

export function NextQuestionLoader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-input bg-card px-5 py-7 text-center" role="status" aria-live="polite">
      <div className="relative size-20" aria-hidden="true">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-vivid [animation-duration:1.1s]" />
        <span className="absolute inset-2.5 animate-spin rounded-full border-2 border-transparent border-t-coral [animation-direction:reverse] [animation-duration:1.6s]" />
        <span className="absolute inset-[21px] grid place-items-center rounded-full bg-indigo-soft text-primary">
          <Sparkles className="size-5" />
        </span>
      </div>
      <div className="grid gap-1">
        <p className="kicker">Next question</p>
        <h3 className="text-lg">{title}</h3>
        <p className="max-w-[40ch] text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
