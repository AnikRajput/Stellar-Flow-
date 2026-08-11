/**
 * Single-project read hook (Phase 10).
 *
 * Shape matches the Phase 10 spec exactly: `(projectId) => { project, loading,
 * error }`. Calls the still-stubbed `fetchProject` read in services/contracts.ts
 * — it never fabricates data. The stub throws until Phase 11 wires real Soroban
 * reads through `useContract` (escrow `get_project`), so callers should treat
 * `error` as the *expected* state for now and render their error UI (which
 * ProjectDetails does).
 */

import { useEffect, useState } from "react";
import { fetchProject } from "@/services/contracts";
import type { Project } from "@/types/project";

export interface UseProjectReturn {
  project: Project | null;
  loading: boolean;
  error: Error | null;
}

export function useProject(projectId: number): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    // A previous id's project must not leak into the new id's view.
    setProject(null);

    // Phase 11: replace with a real Soroban read via useContract.
    fetchProject(projectId)
      .then((data) => {
        if (!active) return;
        setProject(data);
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
  }, [projectId]);

  return { project, loading, error };
}
