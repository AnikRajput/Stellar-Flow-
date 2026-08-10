/**
 * Role-aware project list hook (Phase 8).
 *
 * Calls the still-stubbed contract read function in `services/contracts.ts`
 * (`fetchProjects`) — it never fabricates data. The stub throws until Phase 9/11
 * wires real Soroban reads through `useContract`, so callers should treat
 * `error` as the *expected* state for now and render their error/retry UI
 * (which the Dashboard does).
 */

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchProjects } from "@/services/contracts";
import type { Project } from "@/types/project";

export interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: Error | null;
  /** Re-runs the fetch (drives the Dashboard's Retry button). */
  refetch: () => void;
}

export function useProjects(
  role?: "client" | "freelancer",
): UseProjectsReturn {
  const { address } = useWallet();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Incrementing this re-triggers the fetch effect (manual refetch).
  const [attempt, setAttempt] = useState(0);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    // No connected wallet → nothing to query. Wallet-guarded pages never render
    // in this state, but stay honest anyway: empty list, no error, no spinner.
    if (!address) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    // Phase 9/11: replace with real contract reads via useContract.
    fetchProjects(address, role)
      .then((data) => {
        if (!active) return;
        setProjects(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, role, attempt]);

  return { projects, loading, error, refetch };
}
