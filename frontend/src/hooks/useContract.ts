/**
 * Thin contract-call wrapper (Phase 9).
 *
 * `call()` builds a Soroban transaction for `method` on `contractId` and runs
 * it through the RPC *simulator* — nothing is signed or submitted. The returned
 * value is the raw simulation response, so callers can surface real contract
 * feedback (accepted args, contract errors, returned ids) before the signing
 * flow lands in Phase 11.
 *
 * Arg conversion (documented so callers know exactly what gets sent):
 *  - `xdr.ScVal`      → passed through unchanged (full type control — u32/u64
 *                       params like project ids and due dates must be passed
 *                       this way, e.g. `nativeToScVal(id, { type: "u32" })`)
 *  - G.../C... strkey → Address ScVal
 *  - bigint / number  → i128 ScVal (our contracts denominate amounts in i128
 *                       stroops; nativeToScVal's default would pick the
 *                       smallest fitting int type instead)
 *  - other strings    → String ScVal
 *  - boolean          → Bool ScVal
 */

import { useCallback } from "react";
import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { getNetworkPassphrase, getServer } from "@/services/stellar";

/** Base fee per operation (BASE_FEE); real fees come from simulation later. */
const FEE = "100";

const STRKEY_RE = /^[GC][A-Z2-7]{55}$/;

function toScVal(arg: unknown): xdr.ScVal {
  if (arg instanceof xdr.ScVal) {
    return arg;
  }
  if (typeof arg === "string" && STRKEY_RE.test(arg)) {
    return nativeToScVal(arg, { type: "address" });
  }
  if (typeof arg === "bigint" || typeof arg === "number") {
    // i128 — callers must pass integers (ScInt rejects non-integer numbers).
    return nativeToScVal(arg, { type: "i128" });
  }
  return nativeToScVal(arg);
}

export interface UseContractReturn {
  /**
   * Builds + simulates a call to `method` on `contractId`.
   * Rejects if the wallet isn't connected or the RPC cannot be reached.
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

      const contract = new Contract(contractId);
      const server = getServer();
      const source = await server.getAccount(address);

      const tx = new TransactionBuilder(source, {
        fee: FEE,
        networkPassphrase: getNetworkPassphrase(),
      })
        .addOperation(contract.call(method, ...args.map(toScVal)))
        // TimeoutInfinite — this transaction is only simulated, never submitted.
        .setTimeout(0)
        .build();

      return server.simulateTransaction(tx);
    },
    [address],
  );

  return { call };
}
