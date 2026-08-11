/**
 * Phase 12 — unit tests for the contract-event service (first test file in
 * the repo).
 *
 * Fixtures build REAL XDR with the SDK's `nativeToScVal` (per-element type
 * hints, verified against the installed v16 source), so the decode path is
 * exercised exactly as it will run against a live RPC — no hand-faked ScVal
 * objects. The RPC server itself is mocked so nothing touches the network.
 *
 * Covers the three Phase 12 requirements the todo called out:
 *   1. decode — raw RPC event → `ContractEvent` (bigint coercion, enum
 *      mapping, filtering of noise)
 *   2. live append — `subscribeToEvents` polls forward by cursor and delivers
 *      each new event exactly once
 *   3. unsubscribe — the returned function stops polling for good
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";
import type { rpc } from "@stellar/stellar-sdk";
import {
  fetchEvents,
  fetchEventsPage,
  subscribeToEvents,
} from "@/services/events";
import type { ContractEvent } from "@/types/event";

// Mock the RPC-server factory so no real `rpc.Server` (or network) is used.
vi.mock("@/services/stellar", () => ({
  getServer: vi.fn(),
}));

import { getServer } from "@/services/stellar";

const getServerMock = vi.mocked(getServer);

/* ------------------------------ fixtures -------------------------------- */

/**
 * Valid strkeys so `Address` ScVals actually construct.
 *
 * Hardcoded (NOT `Keypair.random()`) on purpose: noble/ed25519's `abytes`
 * guard rejects the jsdom-provided crypto buffer under vitest. These two are
 * checksum-verified by the test below, and the decode path only needs the
 * strkey format — no crypto involved.
 */
const CLIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const FREELANCER = "GB3KJPLFUYN5VL6R3GU3EGCGVCKFDSD7BEDX42HWG5BWFKB3KQGJJRMA";

/** A contract-id string is used as-is by the decoder (filter-only). */
const CONTRACT_ID = "CXVXU2CEOOJPVIN5LDFEBYFVVLQTDZOVX";

/** Field type hints accepted by `nativeToScVal` for Vec elements. */
type FieldType = "u32" | "u64" | "i128" | "address" | "string" | "symbol";

interface Field {
  value: string | number | bigint;
  type: FieldType;
}

/** Builds the event `value` Vec ScVal with per-element type hints. */
function valueScVal(fields: Field[]): xdr.ScVal {
  return nativeToScVal(
    fields.map((f) => f.value),
    { type: fields.map((f) => f.type) },
  );
}

function makeEventResponse(opts: {
  topic: string;
  fields: Field[];
  ledger: number;
  txHash: string;
  success?: boolean;
  type?: rpc.Api.EventType;
}): rpc.Api.EventResponse {
  return {
    id: `${opts.ledger}:${opts.txHash}`,
    type: opts.type ?? "contract",
    ledger: opts.ledger,
    ledgerClosedAt: "2026-08-11T00:00:00.000Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: opts.success ?? true,
    txHash: opts.txHash,
    topic: [nativeToScVal(opts.topic, { type: "symbol" })],
    value: valueScVal(opts.fields),
  };
}

function makePage(
  events: rpc.Api.EventResponse[],
  cursor: string,
  latestLedger = 100,
): rpc.Api.GetEventsResponse {
  return {
    events,
    cursor,
    latestLedger,
    oldestLedger: 1,
    latestLedgerCloseTime: "2026-08-11T00:00:00.000Z",
    oldestLedgerCloseTime: "2026-08-01T00:00:00.000Z",
  };
}

interface FakeRpcServer {
  getLatestLedger: ReturnType<typeof vi.fn>;
  getEvents: ReturnType<typeof vi.fn>;
}

function makeServer(): FakeRpcServer {
  return {
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 10_000 }),
    getEvents: vi.fn(),
  };
}

function useServer(server: FakeRpcServer): void {
  getServerMock.mockReturnValue(server as unknown as rpc.Server);
}

/* ------------------------- fixture guarantees --------------------------- */

describe("fixtures", () => {
  it("uses checksum-valid public keys", () => {
    expect(StrKey.isValidEd25519PublicKey(CLIENT)).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(FREELANCER)).toBe(true);
  });
});

/* ------------------------------- decode --------------------------------- */

describe("fetchEventsPage (decode)", () => {
  beforeEach(() => {
    getServerMock.mockReset();
  });

  it("decodes PAYMENT_RELEASED: bigint amounts → string, addresses → strkey", async () => {
    const server = makeServer();
    const payment = makeEventResponse({
      topic: "PAYMENT_RELEASED",
      fields: [
        { value: 7, type: "u32" },
        { value: 2, type: "u32" },
        { value: FREELANCER, type: "address" },
        { value: 1_250_000_000n, type: "i128" },
        { value: 1_752_300_000n, type: "u64" },
      ],
      ledger: 1042,
      txHash: "abc123",
    });
    server.getEvents.mockResolvedValue(makePage([payment], "cursor-1"));
    useServer(server);

    const page = await fetchEventsPage(CONTRACT_ID);

    // No cursor → history mode: lookback ledger window is computed first.
    expect(server.getLatestLedger).toHaveBeenCalledTimes(1);
    expect(server.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ type: "contract", contractIds: [CONTRACT_ID] }],
        startLedger: expect.any(Number),
      }),
    );
    expect(page.cursor).toBe("cursor-1");
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      contractId: CONTRACT_ID,
      ledger: 1042,
      topic: "PAYMENT_RELEASED",
      txHash: "abc123",
      timestamp: 1_752_300_000,
      data: {
        projectId: 7,
        milestoneId: 2,
        freelancer: FREELANCER,
        amount: "1250000000",
        timestamp: 1_752_300_000,
      },
    });
  });

  it("maps DISPUTE_RESOLVED outcome enum index to the human name", async () => {
    const server = makeServer();
    const resolved = makeEventResponse({
      topic: "DISPUTE_RESOLVED",
      fields: [
        { value: 3, type: "u32" },
        { value: 11, type: "u32" },
        { value: 1, type: "u32" }, // DisputeOutcome::RefundedToClient
        { value: 1_752_301_000n, type: "u64" },
      ],
      ledger: 1043,
      txHash: "abc124",
    });
    server.getEvents.mockResolvedValue(makePage([resolved], "cursor-2"));
    useServer(server);

    const page = await fetchEventsPage(CONTRACT_ID);

    expect(page.events[0]).toMatchObject({
      topic: "DISPUTE_RESOLVED",
      data: { projectId: 3, disputeId: 11, outcome: "RefundedToClient" },
    });
  });

  it("drops unknown topics and unsuccessful calls instead of guessing", async () => {
    const server = makeServer();
    const unknown = makeEventResponse({
      topic: "NOT_A_REAL_EVENT",
      fields: [],
      ledger: 1,
      txHash: "tx-unknown",
    });
    const failed = makeEventResponse({
      topic: "PAYMENT_RELEASED",
      fields: [
        { value: 1, type: "u32" },
        { value: 1, type: "u32" },
        { value: FREELANCER, type: "address" },
        { value: 1000n, type: "i128" },
        { value: 1_752_302_000n, type: "u64" },
      ],
      ledger: 2,
      txHash: "tx-failed",
      success: false,
    });
    server.getEvents.mockResolvedValue(
      makePage([unknown, failed], "cursor-3"),
    );
    useServer(server);

    const page = await fetchEventsPage(CONTRACT_ID);

    expect(page.events).toHaveLength(0);
  });

  it("fetchEvents passes an explicit startLedger straight through", async () => {
    const server = makeServer();
    server.getEvents.mockResolvedValue(makePage([], "cursor-4"));
    useServer(server);

    await fetchEvents(CONTRACT_ID, 500);

    expect(server.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 500 }),
    );
    // Ledger-window computation must be skipped when startLedger is given.
    expect(server.getLatestLedger).not.toHaveBeenCalled();
  });
});

/* ------------------------------ subscribe ------------------------------- */

describe("subscribeToEvents (honest polling)", () => {
  beforeEach(() => {
    getServerMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls forward by cursor, delivers each event once, and unsubscribes", async () => {
    vi.useFakeTimers();
    const server = makeServer();
    const eventA = makeEventResponse({
      topic: "PROJECT_CREATED",
      fields: [
        { value: 1, type: "u32" },
        { value: CLIENT, type: "address" },
        { value: FREELANCER, type: "address" },
        { value: 5_000_000_000n, type: "i128" },
        { value: 1_752_302_000n, type: "u64" },
      ],
      ledger: 100,
      txHash: "tx-a",
    });
    const eventB = makeEventResponse({
      topic: "MILESTONE_CREATED",
      fields: [
        { value: 1, type: "u32" },
        { value: 1, type: "u32" },
        { value: 2_500_000_000n, type: "i128" },
        { value: 1_752_303_000n, type: "u64" },
      ],
      ledger: 101,
      txHash: "tx-b",
    });
    server.getEvents
      .mockResolvedValueOnce(makePage([eventA], "cursor-a", 100))
      .mockResolvedValueOnce(makePage([eventB], "cursor-b", 101))
      .mockResolvedValue(makePage([], "cursor-c", 102));
    useServer(server);

    const received: ContractEvent[] = [];
    const unsubscribe = subscribeToEvents(CONTRACT_ID, (e) => received.push(e), {
      intervalMs: 1000,
    });

    // The first poll fires immediately (no timer advance needed — flush the
    // microtask chain the immediate tick kicked off). Its request is history
    // mode (no cursor yet — a lookback ledger window is computed).
    await vi.advanceTimersByTimeAsync(0);
    expect(received.map((e) => e.topic)).toEqual(["PROJECT_CREATED"]);
    // Second decode surface: PROJECT_CREATED's u64 timestamp round-trips too.
    expect(received[0]).toMatchObject({ timestamp: 1_752_302_000 });
    expect(server.getEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ startLedger: expect.any(Number) }),
    );

    // The next page must be requested by the previous page's cursor.
    await vi.advanceTimersByTimeAsync(1000);
    expect(received.map((e) => e.topic)).toEqual([
      "PROJECT_CREATED",
      "MILESTONE_CREATED",
    ]);
    expect(server.getEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-a" }),
    );

    // The following tick advances the cursor again; the empty page delivers
    // nothing new (no re-delivery, no duplicates).
    await vi.advanceTimersByTimeAsync(1000);
    expect(received.map((e) => e.topic)).toEqual([
      "PROJECT_CREATED",
      "MILESTONE_CREATED",
    ]);
    expect(server.getEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-b" }),
    );

    // Unsubscribe stops polling entirely.
    unsubscribe();
    const callsBefore = server.getEvents.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.getEvents.mock.calls.length).toBe(callsBefore);
  });

  it("reports transient poll failures via onError and keeps polling", async () => {
    vi.useFakeTimers();
    const server = makeServer();
    server.getEvents
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValue(makePage([], "cursor-d"));
    useServer(server);

    const onError = vi.fn();
    const received: ContractEvent[] = [];
    subscribeToEvents(CONTRACT_ID, (e) => received.push(e), {
      intervalMs: 1000,
      onError,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(server.getEvents).toHaveBeenCalledTimes(1);

    // The next poll succeeds — the feed survives the transient failure.
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.getEvents).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(0);
  });
});
