import { useCallback, useEffect, useState } from "react";
import { api, type ProgressOverview } from "../../lib/api";

export function useProgress() {
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .progress()
      .then((next) => {
        if (active) setData(next);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return { data, error, loading, refresh };
}
