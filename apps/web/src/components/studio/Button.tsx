import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button as BaseButton } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
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

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, "variant" | "size" | "render"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Render a real router link (an <a>, with link semantics) styled as a button. */
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
  ...rest
}: ButtonProps) {
  const classes = cn(
    buttonVariants({ variant: VARIANT[variant] }),
    "gap-2 rounded-lg font-medium [&_svg:not([class*='size-'])]:size-4",
    SIZE[size],
    EXTRA[variant],
    className,
  );

  if (to) {
    // A plain Link keeps role="link"; Base UI's Button would stamp role="button" on an <a>.
    return (
      <Link to={to} className={classes} aria-disabled={disabled || loading || undefined} data-slot="button">
        {children}
      </Link>
    );
  }

  return (
    <BaseButton
      variant={VARIANT[variant]}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </BaseButton>
  );
}
