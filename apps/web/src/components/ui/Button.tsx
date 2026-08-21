import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`];
  if (size !== "md") classes.push(`btn--${size}`);
  if (className) classes.push(className);
  return (
    <button className={classes.join(" ")} disabled={disabled || loading} {...rest}>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
