import type { CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton as BaseSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Spinner({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <Loader2
      className={cn("shrink-0 animate-spin text-indigo-vivid", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 text-sm text-muted-foreground",
        compact ? "min-h-24 flex-row" : "min-h-40 flex-col",
      )}
      role="status"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({
  width,
  height = 16,
  className,
}: {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  className?: string;
}) {
  return <BaseSkeleton className={cn("max-w-full", className)} style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({ title, children, action }: { title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-input bg-background px-6 py-8 text-center text-sm text-muted-foreground">
      {title && <strong className="text-[15px] text-foreground">{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
