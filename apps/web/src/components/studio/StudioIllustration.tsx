import { cn } from "@/lib/utils";

/** Lightweight editorial artwork shared by the public site and practice studio. */
export function StudioIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("illustration-frame", compact && "max-w-[340px]")} aria-hidden="true">
      <div
        className={cn(
          "flex justify-between gap-3 px-5 pt-4 font-mono text-[9px] tracking-[0.08em] uppercase",
          compact && "px-3.5 pt-3 text-[8px]",
        )}
      >
        <span>The speaking studio</span>
        <span>01 / Practice</span>
      </div>
      <svg viewBox="0 0 480 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#090335" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M58 367c103-2 255 2 368 0" />
          <path d="M83 368v-80c0-34 29-50 54-37l30 19v97" fill="#ffb0a1" />
          <path d="m92 284 57 31m-58-14 58 31m-58-14 58 31m-58-14 58 31" strokeWidth="1" />
          <path d="M147 233c-20 8-35 32-39 63l-8 71h144l-11-85c-4-30-28-43-50-51" fill="#fff" />
          <path d="m133 263 15 24-11 24 15 27-14 29m37-119 17 30-11 29 17 30-12 30" strokeWidth="1.4" />
          <path d="m124 279 98-6m-105 28 113-5m-116 28 119-5m-122 29 125-5" strokeWidth="1.4" />
          <path d="M170 213v26c10 14 24 17 38 5l-8-40" fill="#ffb0a1" />
          <path d="M159 148c-1-28 21-43 42-33 20 8 25 25 26 42l12 22-14 6c1 19-8 37-24 39-26 2-47-32-47-51" fill="#fff4f2" />
          <path
            d="M166 165c15-8 18-28 13-41 14 5 34 3 43-9-8-22-41-34-61-19-17-2-35 16-32 33-16 16-11 37 5 46-4 20 14 30 30 28l8-29"
            fill="#090335"
          />
          <path d="M164 168c-10-10-18-2-14 9 3 7 10 12 17 9" fill="#fff4f2" />
          <path d="m207 152 8-1m-4 8v3m1 35c5 2 9 0 11-3" />
          <path d="M139 148c-9-37 32-67 62-44" strokeWidth="7" />
          <path d="M139 148c-9-37 32-67 62-44" stroke="#fff4f2" strokeWidth="3" />
          <path d="M142 148c-7 0-11 6-10 15l2 18c1 7 8 10 15 7l7-3-6-37Z" fill="#ffb0a1" />
          <path d="m143 158 3 18" />
          <path d="M215 272c8 15 12 32 19 40l48-9 8 19-60 19c-14 4-22-8-30-18l-12-20" fill="#fff" />
          <path d="m280 303 20-12c6-4 10 1 6 5l-6 5 27-4c8 0 10 5 4 7l-20 7 21-1c7 1 6 7-1 8l-22 4-19 1" fill="#fff4f2" />
          <path d="m177 367 8-44h-26l-7 44" fill="#090335" />
          <path d="m251 342 92-11 35 19-97 10Z" fill="#fff" />
          <path d="m290 339 43-5m-35 11 44-5m-61 20v6l97-10v-6" strokeWidth="1.4" />
          <path d="M334 196c0-12 9-20 19-20s19 8 19 20v40c0 12-9 21-19 21s-19-9-19-21Z" fill="#090335" />
          <path d="M327 225v12c0 15 11 28 26 28s26-13 26-28v-12m-26 40v65m-23 4 23-4 24 4" />
          <path d="M342 194h22m-22 9h22m-22 9h22m-22 9h22m-20 9h18" stroke="#fff4f2" strokeWidth="1.5" />
          <path d="M276 57h136v78h-71l-22 23 2-23h-45Z" fill="#fff" />
          <path d="M296 94v5m9-15v25m10-34v43m10-29v16m10-42v63m10-52v41m10-30v19m10-25v30m10-42v53m10-32v14m10-8v3" strokeWidth="3" />
          <path d="m71 96 5-17 5 17 17 5-17 5-5 17-5-17-17-5Z" fill="#ffb0a1" />
          <path d="m250 209 14-7m-13 19 16 2m-24-35 5-11" />
          <path
            d="M400 367c-8-24-6-44 0-66m0 38c-18-1-24-13-23-28 17 4 24 13 23 28Zm0-15c1-18 12-25 25-28 1 17-8 26-25 28Z"
            fill="#ffb0a1"
          />
          <path d="m388 350 5 17h19l4-17Z" fill="#fff" />
          <circle cx="422" cy="196" r="5" />
          <path d="m69 210 10 7-11 6m331 52 5-5m0 0 5-5m-5 5-5-5m5 5 5 5" />
        </g>
      </svg>
      <div className={cn("px-4 pb-4 text-center font-serif text-[15px] italic", compact && "pb-3 text-xs")}>
        A quiet space. A little courage. Your voice.
      </div>
    </div>
  );
}

export function FeedbackIllustration() {
  return (
    <div className="illustration-frame pb-5" aria-hidden="true">
      <span className="block px-5 pt-4 font-mono text-[9px] tracking-[0.08em] uppercase">Notes for your next conversation</span>
      <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="p-3">
        <g stroke="#090335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m107 37 208 19-21 236-208-19Z" fill="#ffb0a1" />
          <path d="m86 50 216-12 14 232-216 13Z" fill="#fff" />
          <path d="m120 82 118-6m-116 20 79-4" strokeWidth="3" />
          <path d="m126 129 8 7 13-19m-19 51 8 7 13-19m-19 51 8 7 13-19" />
          <path d="m165 126 103-5m-102 17 73-4m-70 32 98-5m-97 17 69-4m-65 31 102-5m-101 18 78-4" strokeWidth="1.5" />
          <path d="m259 217 80-96 12 10-80 96-22 13Z" fill="#fff4f2" />
          <path d="m339 121 9-11c3-3 5-2 8 0l5 4c3 3 3 6 0 9l-10 8m-92 86 12 10m-20 5 6 5" fill="#090335" />
          <path d="m55 158-18-4m20 23-14 9m11-48-10-15m306 120 6-18 5 18 18 6-18 5-5 18-6-18-18-5Z" />
        </g>
      </svg>
    </div>
  );
}
