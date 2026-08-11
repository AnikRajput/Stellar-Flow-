/**
 * useTransaction tests (Phase 14).
 *
 * The transaction SERVICE layer (`services/transactions.ts`) is mocked — the
 * lifecycle is real (build → simulate → sign → submit → poll) but no network
 * or wallet is touched. `friendlyErrorMessage` stays REAL so the failed-state
 * assertions verify the human-readable mapping, not a test double.
 *
 * Covered:
 *   - `pending` while a submitted tx is unresolved, `confirmed` once it lands
 *   - `failed` with a readable message when simulation reverts
 *     (ContractError(5) → escrow InvalidState)
 *   - `failed` preserving the submitted hash when the tx fails on-chain
 */

import { act, renderHook } from "@testing-library/react";
import { nativeToScVal, rpc, type Transaction } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransaction, type TxExecutionResult } from "@/hooks/useTransaction";

const WALLET = `G${"A".repeat(55)}`;

const txService = vi.hoisted(() => ({
  simulateTx: vi.fn(),
  assembleFromSimulation: vi.fn(),
  signAndSubmit: vi.fn(),
  pollTxStatus: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: WALLET,
    status: "connected",
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
  }),
}));

vi.mock("@/services/transactions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/transactions")>();
  return {
    ...actual, // keeps friendlyErrorMessage + buildTx real
    simulateTx: txService.simulateTx,
    assembleFromSimulation: txService.assembleFromSimulation,
    signAndSubmit: txService.signAndSubmit,
    pollTxStatus: txService.pollTxStatus,
  };
});

/** Stub transaction — the service layer is mocked, so no real envelope. */
const ANY_TX = {} as unknown as Transaction;

/** Successful simulation response (retval decodes to 1n). */
function successSimulation(): rpc.Api.SimulateTransactionResponse {
  return {
    status: "success",
    result: { retval: nativeToScVal(1n, { type: "i128" }) },
  } as unknown as rpc.Api.SimulateTransactionResponse;
}

beforeEach(() => {
  // Reset call history so assertions like "signAndSubmit not called" are not
  // polluted by earlier tests (implementations are re-set below).
  vi.clearAllMocks();
  txService.assembleFromSimulation.mockImplementation(
    (raw: Transaction) => raw as unknown as Transaction,
  );
  txService.signAndSubmit.mockResolvedValue({ status: "SUCCESS", hash: "abc123" });
});

describe("useTransaction", () => {
  it("reaches `pending` while the submitted tx is unresolved, then `confirmed`", async () => {
    txService.simulateTx.mockResolvedValue(successSimulation());

    // pollTxStatus reports NOT_FOUND (→ pending) and only resolves later.
    let resolvePoll!: (value: rpc.Api.GetTransactionResponse) => void;
    txService.pollTxStatus.mockImplementation(
      async (
        _hash: string,
        options?: { onStatus?: (status: rpc.Api.GetTransactionStatus) => void },
      ) => {
        options?.onStatus?.(rpc.Api.GetTransactionStatus.NOT_FOUND);
        return new Promise<rpc.Api.GetTransactionResponse>((resolve) => {
          resolvePoll = resolve;
        });
      },
    );

    const { result } = renderHook(() => useTransaction());
    let execution!: Promise<TxExecutionResult>;

    // Start the lifecycle. Every mocked stage resolves immediately, so a
    // single microtask drain runs build → simulate → sign → submit → poll,
    // leaving the chain awaiting the (still unresolved) poll response.
    act(() => {
      execution = result.current.execute(() => Promise.resolve(ANY_TX));
    });
    await act(async () => {});

    expect(result.current.state).toBe("pending");
    expect(result.current.hash).toBe("abc123");

    // The network finally settles the submitted tx as SUCCESS.
    await act(async () => {
      resolvePoll({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      } as unknown as rpc.Api.GetTransactionResponse);
      await execution;
    });

    expect(result.current.state).toBe("confirmed");
    expect(result.current.error).toBeNull();
  });

  it("reaches `failed` with a human-readable message when simulation reverts", async () => {
    // Simulation error carrying the escrow contract error code for
    // InvalidState (contracts/escrow/src/errors.rs, code 5).
    txService.simulateTx.mockResolvedValue({
      status: "error",
      error: "ContractError(5)",
    } as unknown as rpc.Api.SimulateTransactionResponse);

    const { result } = renderHook(() => useTransaction());
    let outcome!: TxExecutionResult;

    await act(async () => {
      outcome = await result.current.execute(() => Promise.resolve(ANY_TX));
    });

    expect(outcome.outcome).toBe("failed");
    expect(result.current.state).toBe("failed");
    expect(result.current.hash).toBeNull();
    // friendlyErrorMessage maps the code — not the raw stack/error text.
    expect(result.current.error).toContain("escrow contract rejected");
    expect(result.current.error).toContain("InvalidState");
    // Nothing was signed or submitted.
    expect(txService.signAndSubmit).not.toHaveBeenCalled();
  });

  it("preserves the submitted hash when the tx fails on-chain", async () => {
    txService.simulateTx.mockResolvedValue(successSimulation());
    txService.pollTxStatus.mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.FAILED,
    } as unknown as rpc.Api.GetTransactionResponse);

    const { result } = renderHook(() => useTransaction());
    let outcome!: TxExecutionResult;

    await act(async () => {
      outcome = await result.current.execute(() => Promise.resolve(ANY_TX));
    });

    expect(outcome.outcome).toBe("failed");
    expect(result.current.state).toBe("failed");
    // The hash stays linkable even though the tx failed on-chain.
    expect(result.current.hash).toBe("abc123");
    // friendlyErrorMessage turns the on-chain failure into plain language.
    expect(result.current.error).toContain("network rejected");
    expect(result.current.error).toContain("explorer link");
  });
});
