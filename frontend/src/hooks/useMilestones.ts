/**
 * Milestone-list read hook (supporting addition to Phase 10 — the phase lists
 * `useProject` only; ProjectDetails needs the milestone list for the timeline,
 * so this mirrors the `useProjects`/`useProject` pattern).
 *
 * `count` comes from `project.milestoneCount` (ids run 1..count on the escrow
 * contract). When `count` is 0 nothing is fetched — there are no milestones.
 * Calls the still-stubbed `fetchMilestones` read in services/contracts.ts; the
 * stub throws until Phase 11 wires real Soroban reads, so `error` is the
 * expected state for now (the MilestoneTimeline renders it honestly).
 */

import { useEffect, useState } from "react";
import { fetchMilestones } from "@/services/contracts";
import type { Milestone } from "@/types/milestone";

export interface UseMilestonesReturn {
  milestones: Milestone[];
  loading: boolean;
  error: Error | null;
}

export function useMilestones(
  projectId: number,
  count: number,
): UseMilestonesReturn {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (count <= 0) {
      setMilestones([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    // Phase 11: replace with real Soroban reads via useContract
    // (escrow get_milestone for each id 1..count).
    fetchMilestones(projectId, count)
      .then((data) => {
        if (!active) return;
        setMilestones(data);
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
  }, [projectId, count]);

  return { milestones, loading, error };
}
