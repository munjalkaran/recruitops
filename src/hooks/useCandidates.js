import { useCallback, useEffect, useState } from "react";
import { listCandidates, subscribeToCandidates } from "../services/candidateService";

export function useCandidates(enabled = true) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setCandidates(await listCandidates());
      setError(null);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    return subscribeToCandidates(refresh);
  }, [enabled, refresh]);

  return { candidates, setCandidates, loading, error, refresh };
}

