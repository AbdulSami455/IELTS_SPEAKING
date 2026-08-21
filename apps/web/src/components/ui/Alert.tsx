import type { ReactNode } from "react";

type Tone = "error" | "success" | "info";

interface AlertProps {
  tone: Tone;
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
