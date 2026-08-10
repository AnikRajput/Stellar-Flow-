import type { Contract, Transaction, xdr } from "@stellar/stellar-sdk";
import type { rpc } from "@stellar/stellar-sdk";

/** Stub guard — signatures are finalized here, logic lands in Phase 11. */
function notImplemented(fn: string): never {
  throw new Error(`${fn} is not implemented yet — wired up in Phase 11.`);
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
export async function buildTx(params: BuildTxParams): Promise<Transaction> {
  void params;
  return notImplemented("buildTx");
}

/** Simulates a transaction to obtain the result, footprint, and auth. */
export async function simulateTx(
  tx: Transaction,
): Promise<rpc.Api.SimulateTransactionResponse> {
  void tx;
  return notImplemented("simulateTx");
}

export interface SignAndSubmitParams {
  /** Transaction to sign and submit. */
  tx: Transaction;
  /** Passphrase for the target network (see services/stellar.ts). */
  networkPassphrase: string;
  /** Signing account public key (Freighter account). */
  publicKey: string;
}

/** Signs with Freighter, submits to Soroban RPC, returns the send response. */
export async function signAndSubmit(
  params: SignAndSubmitParams,
): Promise<rpc.Api.SendTransactionResponse> {
  void params;
  return notImplemented("signAndSubmit");
}

/** Polls Soroban RPC until the transaction reaches a terminal status. */
export async function pollTxStatus(
  hash: string,
): Promise<rpc.Api.GetTransactionResponse> {
  void hash;
  return notImplemented("pollTxStatus");
}
