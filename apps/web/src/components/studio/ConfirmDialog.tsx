import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
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

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const dialog = pending ? (
    <ConfirmDialog
      {...pending}
      onClose={(confirmed) => {
        pending.resolve(confirmed);
        setPending(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onClose,
}: ConfirmOptions & { onClose: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const element = ref.current;
    // showModal gives us the focus trap, Escape, and inert background for free.
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <div className="dialog-panel">
        <h2 id={titleId}>{title}</h2>
        {body && (
          <div id={bodyId} className="dialog-body">
            {body}
          </div>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger-solid" : "primary"}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
