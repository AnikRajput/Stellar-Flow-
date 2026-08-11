/**
 * Thin contract-call wrapper (Phase 11 — rebuilt on the real service).
 *
 * Keeps the Phase 9 `{ call }` shape, but now delegates to the real
 * `buildTx` + `simulateTx` in services/transactions.ts (single source of
 * truth for argument conversion and transaction assembly). Nothing is signed
 * or submitted — this is the *validation / read* path:
 *
 *  - simulation failures (contract reverts) throw the raw RPC error so
 *    callers can surface real contract feedback
 *  - successful simulations return the raw response, whose `.result.retval`
 *    callers can decode (e.g. the project id from `create_project`)
 *
 * The action buttons no longer use this hook — they run the full lifecycle
 * through `useTransaction`. `fetchProjects` / `fetchProject` /
 * `fetchMilestones` (services/contracts.ts) wire their real reads through
 * `call` in a later phase.
 */

import { useCallback } from "react";
import { Contract, rpc } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { buildTx, simulateTx, toScVal } from "@/services/transactions";

export interface UseContractReturn {
  /**
   * Builds + simulates a call to `method` on `contractId` and returns the raw
   * simulation response. Rejects if the wallet isn't connected, the RPC cannot
   * be reached, or the contract reverts in simulation.
   */
  call: (
    contractId: string,
    method: string,
    args: unknown[],
  ) => Promise<unknown>;
}

export function useContract(): UseContractReturn {
  const { address } = useWallet();

  const call = useCallback(
    async (
      contractId: string,
      method: string,
      args: unknown[],
    ): Promise<unknown> => {
      if (!address) {
        throw new Error("Connect your wallet before calling a contract.");
      }

      const tx = await buildTx({
        contract: new Contract(contractId),
        method,
        args: args.map(toScVal),
        source: address,
      });
      const simulation = await simulateTx(tx);
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(simulation.error);
      }
      return simulation;
    },
    [address],
  );

  return { call };
}
