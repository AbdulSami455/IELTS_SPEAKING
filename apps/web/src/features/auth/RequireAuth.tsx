import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError, api, type User } from "../../lib/api";
import { Alert, Button, LoadingState } from "../../components/ui";
import { UserContext } from "./useUser";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
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
        setMessage(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
          setStatus("unauthorized");
          return;
        }
        setMessage(error instanceof Error ? error.message : "Could not verify your session");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo(() => ({ user, setUser }), [user]);

  if (status === "loading") {
    return (
      <div className="center-page">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  if (status === "unauthorized") {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  if (status === "error") {
    return (
      <div className="center-page">
        <div className="center-panel">
          <Alert
            tone="error"
            title="We couldn’t reach the practice studio"
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
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
