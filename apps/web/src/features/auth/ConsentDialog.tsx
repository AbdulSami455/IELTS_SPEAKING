import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type User } from "../../lib/api";
import { Alert, Button } from "../../components/studio";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const ITEMS = [
  {
    key: "terms",
    label: (
      <>
        I accept the{" "}
        <Link to="/terms" target="_blank" className="underline">
          terms of service
        </Link>{" "}
        and{" "}
        <Link to="/acceptable-use" target="_blank" className="underline">
          acceptable use policy
        </Link>
        .
      </>
    ),
  },
  {
    key: "privacy",
    label: (
      <>
        I have read the{" "}
        <Link to="/privacy" target="_blank" className="underline">
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    key: "recording",
    label:
      "I consent to my voice being recorded, transcribed, and analysed by AI providers to score my practice tests, and deleted on the retention schedule.",
  },
] as const;

type Key = (typeof ITEMS)[number]["key"];

/**
 * Blocking consent step. Shown when the account has not accepted the current
 * policy version (new policy, or an account created before consent was enforced).
 */
export function ConsentDialog({ user, onAccepted }: { user: User; onAccepted: (user: User) => void }) {
  const [checked, setChecked] = useState<Record<Key, boolean>>({ terms: false, privacy: false, recording: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allChecked = ITEMS.every((item) => checked[item.key]);
  const updated = Boolean(user.consentVersion);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      onAccepted(await api.consent());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your consent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-w-lg rounded-lg p-6 sm:max-w-lg">
        <DialogHeader>
          <p className="kicker">Before you practise</p>
          <DialogTitle className="font-serif text-2xl">
            {updated ? "Our terms have been updated" : "Your recordings, your consent"}
          </DialogTitle>
          <DialogDescription className="text-sm text-subtle">
            {updated
              ? "Please review and accept the current policies to continue using the speaking studio."
              : "Practice tests record your voice. Please confirm you’re happy for us to process it before you start."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {ITEMS.map((item) => (
            <Label key={item.key} className="group/field grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 text-sm leading-relaxed font-normal text-subtle">
              <Checkbox
                className="mt-1 size-5"
                checked={checked[item.key]}
                onCheckedChange={(value) => setChecked((current) => ({ ...current, [item.key]: value === true }))}
              />
              <span>{item.label}</span>
            </Label>
          ))}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground">Policy version {user.currentConsentVersion ?? ""}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => void api.logoutAndLeave()}>
                Sign out
              </Button>
              <Button onClick={accept} loading={busy} disabled={!allChecked}>
                Agree and continue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
