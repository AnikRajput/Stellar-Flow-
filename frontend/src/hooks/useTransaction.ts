/**
 * Transaction lifecycle hook (Phase 11).
 *
 * `execute(buildFn)` drives ONE transaction through the real lifecycle:
 *
 *   building → simulating → signing → submitted → pending → confirmed
 *                                └────────── (or `failed` at any point)
 *
 * `state` is advanced stage-by-stage — the UI (TxStatusPanel) renders each
 * distinct stage, and the tx hash becomes available the moment the network
 * accepts the submission (`submitted`), so callers can link to the explorer
 * immediately.
 *
 * Lifecycle details (all backed by `services/transactions.ts`):
 *  - building   → `buildFn()` (a `buildTx` call) — fetches the account +
 *                 assembles the unsigned transaction
 *  - simulating → `simulateTx` + decode the returned retval into `result`;
 *                 simulation errors (contract reverts) fail here, before any
 *                 signing popup
 *  - signing    → Freighter `signTransaction` + `sendTransaction`
 *  - submitted  → RPC accepted the tx; `hash` is set
 *  - pending    → polling `getTransaction` while NOT_FOUND
 *  - confirmed  → `SUCCESS`;  failed → `FAILED` or any thrown error
 *
 * The resolved value carries `{ outcome, hash, error, result }` so chained
 * flows (e.g. the wizard: create_project then add_milestone per row) can
 * sequence transactions without reading React state mid-await.
 */

import { useCallback, useRef, useState } from "react";
import { rpc, scValToNative, type Transaction } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { getNetworkPassphrase } from "@/services/stellar";
import {
  assembleFromSimulation,
  friendlyErrorMessage,
  pollTxStatus,
  signAndSubmit,
  simulateTx,
} from "@/services/transactions";
import type { TxState } from "@/types/transaction";

export type TxOutcome = "confirmed" | "failed";

export interface TxExecutionResult {
  outcome: TxOutcome;
  hash: string | null;
  error: string | null;
  /** Decoded simulation retval (e.g. the created project id). */
  result: unknown;
}

export interface UseTransactionReturn {
  state: TxState;
  /** Set from the moment the network accepts the submission. */
  hash: string | null;
  /** Plain-language failure reason (see friendlyErrorMessage). */
  error: string | null;
  /** Decoded retval from the most recent execute's simulation. */
  result: unknown;
  execute: (buildFn: () => Promise<Transaction>) => Promise<TxExecutionResult>;
}

export function useTransaction(): UseTransactionReturn {
  const { address } = useWallet();
  const [state, setState] = useState<TxState>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(undefined);
  // Guards against overlapping executes (buttons are disabled, but double
  // clicks / double submits must not build two txs from one sequence number).
  const runningRef = useRef(false);

  const execute = useCallback(
    async (buildFn: () => Promise<Transaction>): Promise<TxExecutionResult> => {
      if (runningRef.current) {
        return {
          outcome: "failed",
          hash: null,
          error: "A transaction is already in progress — wait for it to finish.",
          result: undefined,
        };
      }
      runningRef.current = true;

      const fail = (
        failure: unknown,
        failureHash: string | null = null,
        failureResult: unknown = undefined,
      ): TxExecutionResult => {
        const friendly = friendlyErrorMessage(failure);
        setState("failed");
        setHash(failureHash);
        setError(friendly);
        return { outcome: "failed", hash: failureHash, error: friendly, result: failureResult };
      };

      // Tracks the hash of a submitted tx so failures AFTER submission (on-chain
      // FAILED, poll timeout) keep the explorer link — declared before the try
      // because the catch must be able to read it (TDZ otherwise).
      let submittedHash: string | null = null;

      try {
        if (!address) {
          return fail(new Error("Connect your wallet before submitting a transaction."));
        }

        // 1. Build the unsigned transaction.
        setState("building");
        setHash(null);
        setError(null);
        setResult(undefined);
        const raw = await buildFn();

        // 2. Simulate: real contract feedback before anything is signed.
        setState("simulating");
        const simulation = await simulateTx(raw);
        if (rpc.Api.isSimulationError(simulation)) {
          throw new Error(simulation.error);
        }
        if (rpc.Api.isSimulationRestore(simulation)) {
          throw new Error(
            "The contract requires restoring expired ledger entries before this transaction can run.",
          );
        }
        let decodedResult: unknown;
        if (rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
          try {
            decodedResult = scValToNative(simulation.result.retval);
          } catch {
            // Undecodable retval — the simulation still succeeded.
            decodedResult = undefined;
          }
        }
        const prepared = assembleFromSimulation(raw, simulation);

        // 3. Sign (Freighter) + submit.
        setState("signing");
        const sendResponse = await signAndSubmit({
          tx: prepared,
          networkPassphrase: getNetworkPassphrase(),
          publicKey: address,
        });
        if (sendResponse.status === "ERROR") {
          let name = "unknown";
          if (sendResponse.errorResult) {
            try {
              name = sendResponse.errorResult.result().switch().name;
            } catch {
              // Keep the generic name if the result can't be decoded.
            }
          }
          throw new Error(`send-error:${name}`);
        }
        submittedHash = sendResponse.hash;

        // 4. Submitted — hash is now linkable; flip to pending once polling
        //    actually starts (first non-terminal getTransaction round).
        setState("submitted");
        setHash(submittedHash);
        const finalResponse = await pollTxStatus(submittedHash, {
          onStatus: () => setState("pending"),
        });

        // 5. Terminal state. pollTxStatus resolves on SUCCESS or FAILED only.
        if (finalResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setState("confirmed");
          setResult(decodedResult);
          return {
            outcome: "confirmed",
            hash: submittedHash,
            error: null,
            result: decodedResult,
          };
        }
        if (finalResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
          // Include the on-chain result code when decodable.
          let detail = "The transaction failed on-chain.";
          if (finalResponse.resultXdr) {
            try {
              detail = `The transaction failed on-chain (${finalResponse.resultXdr.result().switch().name}).`;
            } catch {
              // Keep the generic detail.
            }
          }
          throw new Error(detail);
        }
        throw new Error("The transaction did not reach a final state.");
      } catch (failure) {
        // Preserve the submitted hash so failed/timeout txs stay linkable.
        return fail(failure, submittedHash);
      } finally {
        runningRef.current = false;
      }
    },
    [address],
  );

  return { state, hash, error, result, execute };
}
