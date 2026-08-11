import { Contract } from "@stellar/stellar-sdk";
import { CONTRACTS } from "@/config/contracts";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";

/** project-factory contract instance (address from VITE_FACTORY_CONTRACT_ID). */
export function getFactoryContract(): Contract {
  return new Contract(CONTRACTS.factory);
}

/** escrow contract instance (address from VITE_ESCROW_CONTRACT_ID). */
export function getEscrowContract(): Contract {
  return new Contract(CONTRACTS.escrow);
}

/** payment-vault contract instance (address from VITE_PAYMENT_VAULT_CONTRACT_ID). */
export function getVaultContract(): Contract {
  return new Contract(CONTRACTS.vault);
}

/* --------------------------- contract reads (stubs) ------------------------ */

/**
 * Fetches the projects a wallet is party to, optionally filtered by role.
 *
 * STUB — Phase 8 calls this from `useProjects`; it throws so the UI never
 * presents fabricated data. Real Soroban `contract.call()` reads are wired in
 * Phase 9/11 once the `useContract` helper exists (query `get_projects` on the
 * project-factory contract).
 *
 * @param address Connected wallet public key (G...).
 * @param role When given, only projects where the wallet has this role.
 */
export async function fetchProjects(
  address: string,
  role?: "client" | "freelancer",
): Promise<Project[]> {
  void address;
  void role;
  throw new Error(
    "fetchProjects is not implemented yet — wired up in Phase 9 with useContract.",
  );
}

/**
 * Fetches a single project by id (escrow `get_project` read).
 *
 * STUB — throws so the UI never presents fabricated data. Phase 11 wires this
 * to a real Soroban read through `useContract` (escrow `get_project`, decoded
 * from the returned ScVal into the `Project` shape).
 */
export async function fetchProject(projectId: number): Promise<Project> {
  void projectId;
  throw new Error(
    "fetchProject is not implemented yet — wired up in Phase 11 with useContract.",
  );
}

/**
 * Fetches a project's milestones (escrow `get_milestone` per id).
 *
 * STUB — throws so the UI never presents fabricated data. Milestone ids run
 * 1..count on the escrow contract; Phase 11 wires this to real Soroban reads
 * through `useContract` (one `get_milestone(project_id, id)` per milestone).
 */
export async function fetchMilestones(
  projectId: number,
  count: number,
): Promise<Milestone[]> {
  void projectId;
  void count;
  throw new Error(
    "fetchMilestones is not implemented yet — wired up in Phase 11 with useContract.",
  );
}
