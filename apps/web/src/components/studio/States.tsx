import type { CSSProperties, ReactNode } from "react";

export function Spinner({ size = 22 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`loading-state${compact ? " loading-state--compact" : ""}`} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width, height = 16 }: { width?: CSSProperties["width"]; height?: CSSProperties["height"] }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {title && <strong className="empty-title">{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
