import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + optional hint. The child control receives the label via `htmlFor` through wrapping. */
export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div data-field-control id={`${id}-control`} className="[&_input]:w-full [&_select]:w-full">
        {children}
      </div>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const CONTROL =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={cn(CONTROL, className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        CONTROL,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236c6475%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9 outline-none",
        className,
      )}
      {...props}
    />
  );
}
