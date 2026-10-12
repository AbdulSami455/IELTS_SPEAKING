import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <svg className={cn("shrink-0", compact ? "size-7" : "size-8")} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="6" fill="currentColor" />
        <path d="M11 18v4m6-10v16m6-19v22m6-15v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-tight">IELTS Speaking</span>
        {!compact && <span className="block text-[11px] font-medium text-muted-foreground">by Hinterbuild</span>}
      </span>
    </span>
  );
}
