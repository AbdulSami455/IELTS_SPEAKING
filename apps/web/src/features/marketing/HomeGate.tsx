import { useEffect, useMemo, useState } from "react";
import { ApiError, api, onConsentRequired, type User } from "../../lib/api";
import { Alert, Button, LoadingState } from "../../components/studio";
import { ConsentDialog } from "../auth/ConsentDialog";
import { UserContext } from "../auth/useUser";
import { DashboardPage } from "../dashboard/DashboardPage";
import { LandingPage } from "./LandingPage";

/** Guests see the public site. Signed-in users land in the practice studio. */
export function HomeGate() {
  const [status, setStatus] = useState<"loading" | "ready" | "guest" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((next) => {
        if (cancelled) return;
        setUser(next);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
          setStatus("guest");
          return;
        }
        setMessage(error instanceof Error ? error.message : "Could not reach the studio");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => onConsentRequired(() => setUser((current) => (current ? { ...current, consentRequired: true } : current))), []);

  const value = useMemo(() => ({ user, setUser }), [user]);

  if (status === "loading") {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoadingState label="Opening IELTS Speaking…" />
      </div>
    );
  }
  if (status === "guest") return <LandingPage />;
  if (status === "error") {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="w-full max-w-lg">
          <Alert
            tone="error"
            title="We couldn’t open the studio"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </Button>
            }
          >
            {message}
          </Alert>
        </div>
      </div>
    );
  }
  return (
    <UserContext.Provider value={value}>
      {user?.consentRequired && <ConsentDialog user={user} onAccepted={setUser} />}
      <DashboardPage />
    </UserContext.Provider>
  );
}
