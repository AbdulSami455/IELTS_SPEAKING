import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError, api } from "../../lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(() => {
        if (cancelled) return;
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
  }, []);

  if (status === "loading") {
    return (
      <div className="center-page">
        <p>Checking your session…</p>
      </div>
    );
  }
  if (status === "unauthorized") return <Navigate to="/login" replace />;
  if (status === "error") {
    return (
      <div className="center-page">
        <p>{message}</p>
      </div>
    );
  }
  return <>{children}</>;
}
