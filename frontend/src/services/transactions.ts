/**
 * Transaction lifecycle service (Phase 11 — replaces the Phase 6 stub).
 *
 * The four stages of a contract transaction, each backed by a real call:
 *
 *   1. `buildTx`          — assemble an unsigned Soroban transaction
 *   2. `simulateTx`       — `rpc.Server.simulateTransaction` (dry run: results,
 *                           footprint, auth, fees) + `assembleFromSimulation`
 *                           to apply those results so the tx can be signed
 *   3. `signAndSubmit`    — Freighter `signTransaction`, then
 *                           `rpc.Server.sendTransaction`
 *   4. `pollTxStatus`     — poll `rpc.Server.getTransaction` until SUCCESS /
 *                           FAILED, or timeout
 *
 * `friendlyErrorMessage` translates common failures (declined signature,
 * insufficient balance, contract error codes from `errors.rs`, RPC unreachable,
 * timeout, on-chain rejection) into plain language — callers never surface raw
 * stack traces.
 *
 * API surface verified against the installed packages:
 *   - @stellar/stellar-sdk v16.1.0 (`rpc.Server`, `rpc.assembleTransaction`,
 *     `Api.isSimulationError/…`, `GetTransactionStatus`)
 *   - @stellar/freighter-api v5 (`signTransaction` → `{ signedTxXdr, error }`)
 */

import {
  BASE_FEE,
  Contract,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { getNetworkPassphrase, getServer } from "@/services/stellar";
import { escrowErrorMessages } from "@/types/transaction";

/** Freighter's "user declined the request" error code (see useWallet.ts). */
const FREIGHTER_DECLINED_ERROR_CODE = -4;

/**
 * Validity window for submitted transactions. Phase 9's simulation-only
 * builder used TimeoutInfinite; real submissions must expire so a stuck tx
 * can't be mined later.
 */
const TX_TIMEOUT_SECONDS = 30;

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_POLL_TIMEOUT_MS = 60_000;

/** G/C strkey: 1 version byte + 55 base32 chars (alphabet excludes 0/O/I/L). */
const STRKEY_RE = /^[GC][A-Z2-7]{55}$/;

/**
 * Converts a JS value to the ScVal the contract expects (same rules the
 * Phase 9 `useContract` documented):
 *  - `xdr.ScVal`      → passed through unchanged (full type control — u32/u64
 *                       params like ids and due dates must be passed this way,
 *                       e.g. `nativeToScVal(id, { type: "u32" })`)
 *  - G.../C... strkey → Address ScVal
 *  - bigint / number  → i128 ScVal (our contracts denominate amounts in i128
 *                       stroops)
 *  - other strings    → String ScVal
 *  - boolean          → Bool ScVal
 */
export function toScVal(arg: unknown): xdr.ScVal {
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

export interface BuildTxParams {
  /** Contract instance the invocation targets. */
  contract: Contract;
  /** Contract method name, e.g. "create_project". */
  method: string;
  /** Method arguments as Soroban SCVals, in declaration order. */
  args: xdr.ScVal[];
  /** Source account public key that will sign the transaction. */
  source: string;
}

/** Builds an unsigned Soroban transaction from a contract invocation. */
export async function buildTx({
  contract,
  method,
  args,
  source,
}: BuildTxParams): Promise<Transaction> {
  const server = getServer();
  const account = await server.getAccount(source);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();
}

/** Simulates a transaction to obtain the result, footprint, and auth. */
export async function simulateTx(
  tx: Transaction,
): Promise<rpc.Api.SimulateTransactionResponse> {
  return getServer().simulateTransaction(tx);
}

/**
 * Applies a simulation's footprint, auth entries, and resource fee to the raw
 * transaction, producing the exact envelope Freighter should sign.
 */
export function assembleFromSimulation(
  raw: Transaction,
  simulation: rpc.Api.SimulateTransactionResponse,
): Transaction {
  return rpc.assembleTransaction(raw, simulation).build();
}

export interface SignAndSubmitParams {
  /** Transaction to sign and submit. */
  tx: Transaction;
  /** Passphrase for the target network (see services/stellar.ts). */
  networkPassphrase: string;
  /** Signing account public key (Freighter account). */
  publicKey: string;
}

/**
 * Signs with Freighter and submits to Soroban RPC.
 *
 * Throws on: declined signature, Freighter failure, RPC transport errors, or a
 * network-level rejection (`sendTransaction` → ERROR). `TRY_AGAIN_LATER` is
 * transient, so it is retried once before giving up.
 */
export async function signAndSubmit({
  tx,
  networkPassphrase,
  publicKey,
}: SignAndSubmitParams): Promise<rpc.Api.SendTransactionResponse> {
  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase,
    address: publicKey,
  });

  if (signed.error) {
    if (signed.error.code === FREIGHTER_DECLINED_ERROR_CODE) {
      throw new Error("Signature request declined in Freighter.");
    }
    throw new Error("Freighter couldn't sign the transaction — please try again.");
  }

  const signedTx = new Transaction(signed.signedTxXdr, networkPassphrase);
  const server = getServer();

  let response = await server.sendTransaction(signedTx);
  if (response.status === "TRY_AGAIN_LATER") {
    response = await server.sendTransaction(signedTx);
  }
  return response;
}

export interface PollTxStatusOptions {
  /** Delay between polls (default 1500ms). */
  intervalMs?: number;
  /** Give up after this long and throw `TxTimeoutError` (default 60s). */
  timeoutMs?: number;
  /** Called on each non-terminal poll result (lets UIs flip to "pending"). */
  onStatus?: (status: rpc.Api.GetTransactionStatus) => void;
}

/** Thrown when a transaction neither succeeds nor fails before the timeout. */
export class TxTimeoutError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls Soroban RPC until the transaction reaches a terminal status
 * (`SUCCESS` or `FAILED`). `NOT_FOUND` keeps polling. Throws `TxTimeoutError`
 * when the deadline passes.
 */
export async function pollTxStatus(
  hash: string,
  options: PollTxStatusOptions = {},
): Promise<rpc.Api.GetTransactionResponse> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const server = getServer();
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const response = await server.getTransaction(hash);
    if (
      response.status === rpc.Api.GetTransactionStatus.SUCCESS ||
      response.status === rpc.Api.GetTransactionStatus.FAILED
    ) {
      return response;
    }
    options.onStatus?.(response.status);
    if (Date.now() >= deadline) {
      throw new TxTimeoutError(
        `Transaction ${hash} timed out after ${Math.round(timeoutMs / 1000)}s — it may still confirm; check the explorer.`,
      );
    }
    await sleep(intervalMs);
  }
}

/**
 * Maps a caught error to a plain-language message. Never returns raw stack
 * traces. Contract error codes (soroban `ContractError(N)` / `Error(Contract,
 * #N)`) are looked up in `types/transaction.ts` (`escrowErrorMessages` —
 * `contracts/escrow/src/errors.rs`, codes 1..=10).
 */
export function friendlyErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const text = message.toLowerCase();

  if (text.includes("declined")) {
    return "Signature request declined — approve the request in the Freighter popup to continue.";
  }

  // Network-level rejections from sendTransaction ("send-error:trXxx").
  if (text.startsWith("send-error:")) {
    if (text.includes("insufficient")) {
      return "Insufficient balance — the signing account needs more funds for the escrow and fees.";
    }
    if (text.includes("badauth")) {
      return "Authorization failed — this wallet isn't the party this action requires.";
    }
    if (text.includes("noaccount")) {
      return "The source account doesn't exist on this network — fund it on Testnet first (friendbot).";
    }
    if (text.includes("too")) {
      return "This transaction expired before it could be included — try again.";
    }
    return "The network rejected this transaction — check the details and try again.";
  }

  // Contract reverts: soroban surfaces custom errors as ContractError(code).
  const contractCode = message.match(
    /ContractError\((\d+)\)|Error\(Contract,\s*#(\d+)\)/,
  );
  if (contractCode) {
    const code = Number(contractCode[1] ?? contractCode[2]);
    const name = escrowErrorMessages[code];
    if (name) {
      return `The escrow contract rejected this transaction: ${name}${
        code === 5
          ? " — the milestone isn't in the right state for this action."
          : ""
      }`;
    }
    return `The escrow contract rejected this transaction (error ${code}).`;
  }

  if (text.includes("simulation failed") || text.includes("hosterror")) {
    return "The contract rejected this transaction during simulation.";
  }
  if (text.includes("restor")) {
    return "On-chain data for this contract expired — restoration is needed before submitting.";
  }
  if (text.includes("insufficient")) {
    return "Insufficient balance — the signing account needs more funds for the escrow and fees.";
  }
  if (text.includes("badauth") || text.includes("unauthorized")) {
    return "This wallet isn't authorized for this action.";
  }
  if (text.includes("noaccount") || text.includes("account not found")) {
    return "This wallet account isn't on this network yet — fund it on Testnet first (friendbot).";
  }
  if (text.includes("connect your wallet")) {
    return "Connect your wallet to submit this transaction.";
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("network error") ||
    text.includes("econnrefused") ||
    text.includes("econnaborted") ||
    text.includes("enotfound") ||
    text.includes("rpc")
  ) {
    return "Can't reach the Stellar RPC — check your connection and try again.";
  }
  if (
    text.includes("too late") ||
    text.includes("too early") ||
    text.includes("expired") ||
    text.includes("timeout")
  ) {
    return "This transaction didn't complete in time — check the explorer and try again.";
  }
  if (text.includes("failed on-chain")) {
    return "The network rejected this transaction — see the explorer link for details.";
  }
  return "Something went wrong with this transaction. Check your connection and try again.";
}
