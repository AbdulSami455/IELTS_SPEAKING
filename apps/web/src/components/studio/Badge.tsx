import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "accent" | "dark" | "success" | "warning" | "danger";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const toneClass = tone === "neutral" ? "" : ` pill--${tone}`;
  return <span className={`pill${toneClass}`}>{children}</span>;
}
