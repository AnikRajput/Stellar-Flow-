import { Contract } from "@stellar/stellar-sdk";
import { CONTRACTS } from "@/config/contracts";
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
