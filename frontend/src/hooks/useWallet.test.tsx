/**
 * useWallet tests (Phase 14).
 *
 * Mocks the `@stellar/freighter-api` module (never touches a real extension).
 *
 * Asserted transitions:
 *   - disconnected → connected → disconnected (connect + disconnect)
 *   - declined requestAccess → `declined` error
 *   - failed requestAccess → `not-installed` error
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWallet } from "@/hooks/useWallet";
import { getNetworkPassphrase } from "@/services/stellar";

const WALLET = `G${"A".repeat(55)}`;

const freighter = vi.hoisted(() => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => freighter);

beforeEach(() => {
  freighter.isConnected.mockResolvedValue({
    isConnected: false,
    error: undefined,
  });
  freighter.requestAccess.mockResolvedValue({ error: undefined });
  freighter.getAddress.mockResolvedValue({
    address: WALLET,
    error: undefined,
  });
  freighter.getNetwork.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: getNetworkPassphrase(),
    error: undefined,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useWallet", () => {
  it("transitions disconnected → connected → disconnected", async () => {
    const { result } = renderHook(() => useWallet());

    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.address).toBe(WALLET);
    expect(result.current.error).toBeNull();
    expect(freighter.requestAccess).toHaveBeenCalledTimes(1);
    expect(freighter.getAddress).toHaveBeenCalledTimes(1);

    act(() => result.current.disconnect());

    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
  });

  it("reports a declined connection request as `declined`", async () => {
    // FreighterApiDeclinedError — code -4 (see useWallet.ts).
    freighter.requestAccess.mockResolvedValue({
      error: { code: -4, message: "User declined" },
    });

    const { result } = renderHook(() => useWallet());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
    expect(result.current.error?.code).toBe("declined");
  });

  it("reports `not-installed` when requestAccess fails", async () => {
    // Simulate Freighter not being installed — requestAccess throws.
    freighter.requestAccess.mockRejectedValue(new Error("Freighter is not installed"));

    const { result } = renderHook(() => useWallet());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
    expect(result.current.error?.code).toBe("not-installed");
    expect(freighter.requestAccess).toHaveBeenCalledTimes(1);
  });
});
