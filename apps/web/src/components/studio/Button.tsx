import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button as BaseButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid" | "coral" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, "default" | "outline" | "ghost" | "destructive" | "link"> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
  "danger-solid": "default",
  coral: "default",
  link: "link",
};

const EXTRA: Partial<Record<Variant, string>> = {
  "danger-solid": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  coral: "bg-coral text-coral-foreground hover:bg-coral/85",
  secondary: "border-input text-foreground",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
  icon: "size-10 p-0",
};

export interface ButtonProps extends Omit<React.ComponentProps<typeof BaseButton>, "variant" | "size"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Render as a router link instead of a button. */
  to?: string;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  to,
  render,
  ...rest
}: ButtonProps) {
  const asLink: ReactElement | undefined = to ? <Link to={to} /> : undefined;
  return (
    <BaseButton
      variant={VARIANT[variant]}
      className={cn(
        "gap-2 rounded-lg font-medium [&_svg:not([class*='size-'])]:size-4",
        SIZE[size],
        EXTRA[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={to ? undefined : type}
      render={render ?? asLink}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </BaseButton>
  );
}
