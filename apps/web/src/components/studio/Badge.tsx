import type { ReactNode } from "react";
import { Badge as BaseBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "dark" | "success" | "warning" | "danger";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-border bg-card text-subtle",
  accent: "border-transparent bg-accent text-accent-foreground",
  dark: "border-transparent bg-primary text-primary-foreground",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  danger: "border-transparent bg-destructive/10 text-destructive",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <BaseBadge variant="outline" className={cn("h-6 rounded-md px-2.5 text-xs font-medium", TONE[tone], className)}>
      {children}
    </BaseBadge>
  );
}
