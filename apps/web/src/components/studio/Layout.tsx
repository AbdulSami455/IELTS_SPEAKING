import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Flat white panel; the building block of every studio screen. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-lg border border-border bg-card p-6 max-sm:p-5 [&>*]:min-w-0", className)} {...props} />;
}

export function PageHeading({
  kicker,
  title,
  lead,
  action,
  titleId,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="grid gap-2">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 id={titleId}>{title}</h1>
        {lead && <p className="max-w-[62ch] text-muted-foreground">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  lead,
  action,
  titleId,
  as: Tag = "h2",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  titleId?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="grid gap-1">
        {kicker && <p className="kicker">{kicker}</p>}
        <Tag id={titleId}>{title}</Tag>
        {lead && <p className="text-[13px] text-muted-foreground">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatGrid({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", className)} {...props} />;
}

export function Stat({
  label,
  value,
  note,
  icon,
  small = false,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className="grid content-start gap-1.5 rounded-lg border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground/70 [&_svg]:size-[18px]">{icon}</span>}
      </div>
      <b className={cn("leading-none tracking-tight text-foreground tabular-nums", small ? "text-xl" : "text-3xl")}>{value}</b>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-subtle transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground",
            size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-[13px]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function IconTile({ children, size = "md", className }: { children: ReactNode; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-lg bg-indigo-soft text-primary",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TextLink({
  to,
  children,
  className,
  size = "md",
}: {
  to: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-1.5 font-medium text-foreground no-underline hover:underline",
        size === "sm" ? "text-[13px]" : "text-sm",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
