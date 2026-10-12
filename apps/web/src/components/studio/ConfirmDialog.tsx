import { useCallback, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

// Promise-based replacement for window.confirm. Render `dialog` somewhere in
// the component, then `if (await confirm({...}))`.
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = pending ? (
    <AlertDialog open onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent className="max-w-md rounded-lg p-6 sm:max-w-md">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="font-serif text-xl">{pending.title}</AlertDialogTitle>
          {pending.body && <AlertDialogDescription className="text-sm text-subtle">{pending.body}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-6 -mb-6 bg-background px-6 py-4">
          <Button variant="secondary" onClick={() => close(false)}>
            {pending.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={pending.tone === "danger" ? "danger-solid" : "primary"} onClick={() => close(true)} autoFocus>
            {pending.confirmLabel ?? "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, dialog };
}
