import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "error" | "warning" | "success" | "info";

const ICONS: Record<Tone, IconName> = {
  error: "alert",
  warning: "alert",
  success: "check",
  info: "info",
};

interface AlertProps {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}

export function Alert({ tone, title, children, action }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={ICONS[tone]} size={18} className="alert-icon" />
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="alert-action">{action}</div>}
    </div>
  );
}
