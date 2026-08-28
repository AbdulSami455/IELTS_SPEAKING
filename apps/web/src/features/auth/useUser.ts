import { useCallback, useEffect, useState } from "react";
import { ApiError, api, type User } from "../../lib/api";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.me();
      setUser(next);
      setError(null);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.code === "AUTH_REQUIRED") {
        setUser(null);
        setError("AUTH_REQUIRED");
        return null;
      }
      if (err instanceof ApiError && err.code !== "RATE_LIMITED") {
        setError(err.message);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, setUser, error, refresh };
}
