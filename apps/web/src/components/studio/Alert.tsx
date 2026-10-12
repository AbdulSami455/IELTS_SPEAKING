import type { ReactNode } from "react";
import { CircleCheck, Info, OctagonX, TriangleAlert } from "lucide-react";
import { Alert as BaseAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Tone = "error" | "warning" | "success" | "info";

const ICONS = {
  error: OctagonX,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
};

const TONE: Record<Tone, string> = {
  error: "border-destructive/30 bg-destructive/5 text-destructive [&_[data-slot=alert-description]]:text-destructive/90",
  warning: "border-warning/30 bg-warning-soft text-warning [&_[data-slot=alert-description]]:text-warning/90",
  success: "border-success/30 bg-success-soft text-success [&_[data-slot=alert-description]]:text-success/90",
  info: "border-border bg-indigo-soft text-foreground [&_[data-slot=alert-description]]:text-subtle [&>svg]:text-indigo-vivid",
};

interface AlertProps {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone, title, children, action, className }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <BaseAlert
      role={tone === "error" ? "alert" : "status"}
      className={cn("items-start gap-x-3 px-4 py-3 text-sm", TONE[tone], action && "sm:pr-40", className)}
    >
      <Icon className="size-4" aria-hidden="true" />
      {title && <AlertTitle className="leading-snug">{title}</AlertTitle>}
      {children && <AlertDescription className="text-sm">{children}</AlertDescription>}
      {action && <div className="col-start-2 mt-2 sm:absolute sm:top-2.5 sm:right-3 sm:mt-0">{action}</div>}
    </BaseAlert>
  );
}
