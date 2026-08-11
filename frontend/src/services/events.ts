/**
 * Contract event service (Phase 12 — replaces the Phase 6 stub).
 *
 * Soroban RPC exposes contract events through JSON-RPC `getEvents` — there is
 * NO native push channel, so "live" delivery is HONEST POLLING: every N
 * seconds we page forward through the RPC's opaque cursor, which only returns
 * events not yet delivered. Nothing here pretends to be a websocket.
 *
 * Decoding: each event's `topic` is `[Symbol("NAME")]` and its `value` is the
 * contracttype struct serialized as a Vec of fields in declaration order (see
 * the event tables in the `events.rs` modules under `contracts/`).
 * `scValToNative` (verified against the installed v16 source) returns u32 →
 * number, u64/i128 → bigint, Address → strkey string, String/Symbol → string,
 * Vec → array — so amounts (i128 bigint) are coerced to the `string` shape
 * the Phase 6 `ContractEvent` types declare, and u64 timestamps to `number`.
 */

import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { getServer } from "@/services/stellar";
import type {
  ContractEvent,
  ContractEventName,
  DisputeOutcome,
} from "@/types/event";

/** Callback receiving a single decoded contract event. */
export type EventListener = (event: ContractEvent) => void;

/**
 * Ledgers of history scanned on an initial page. Testnet closes roughly every
 * 5s, so this window ≈ a few hours of recent activity without paging forever
 * from ledger 1.
 */
export const DEFAULT_HISTORY_LOOKBACK_LEDGERS = 5000;
/** Interval between live polls (Soroban RPC has no push channel). */
export const DEFAULT_POLL_INTERVAL_MS = 5000;
/** Events returned per `getEvents` page. */
const HISTORY_LIMIT = 100;

/** Every topic published by escrow, payment-vault, and project-factory. */
const ALL_EVENT_NAMES: ReadonlySet<string> = new Set([
  "FUNDS_DEPOSITED",
  "MILESTONE_CREATED",
  "MILESTONE_SUBMITTED",
  "MILESTONE_APPROVED",
  "PAYMENT_RELEASED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "PROJECT_CANCELLED",
  "REFUND_ISSUED",
  "PROJECT_COMPLETED",
  "FUNDS_HELD",
  "FUNDS_RELEASED",
  "FUNDS_REFUNDED",
  "PROJECT_CREATED",
  "PROJECT_PAUSED",
]);

/** `DisputeOutcome` contracttype enum, by u32 index (events.rs declaration order). */
const OUTCOME_NAMES: readonly DisputeOutcome[] = [
  "ReleasedToFreelancer",
  "RefundedToClient",
];

/* ------------------------- type coercion helpers ------------------------- */

function toNumber(value: unknown): number {
  // bigint (u64) → number; u64 timestamps fit safely well past year 2000.
  return Number(value);
}

function toStroopsString(value: unknown): string {
  // i128 decodes as bigint — the Phase 6 types declare amounts as strings.
  return typeof value === "bigint" ? value.toString() : String(value);
}

function toAddressString(value: unknown): string {
  // Address decodes as a strkey string; fall back defensively.
  return typeof value === "string" ? value : String(value);
}

/* ------------------------------ fetching -------------------------------- */

export interface EventsPageOptions {
  /** Earliest ledger to scan from (mutually exclusive with `cursor`). */
  startLedger?: number;
  /** Opaque RPC cursor — pages forward, returning only new events. */
  cursor?: string;
  /** Max events per page. */
  limit?: number;
}

export interface EventsPage {
  events: ContractEvent[];
  /** Opaque RPC cursor for the next incremental page. */
  cursor: string;
}

/**
 * Fetches one page of events for `contractId`, decoded into `ContractEvent`s.
 * Without `startLedger` or `cursor` it scans a recent ledger window (see
 * `DEFAULT_HISTORY_LOOKBACK_LEDGERS`) so an unbounded history can't be paged
 * forever.
 */
export async function fetchEventsPage(
  contractId: string,
  options: EventsPageOptions = {},
): Promise<EventsPage> {
  const server = getServer();
  const limit = options.limit ?? HISTORY_LIMIT;
  const filters: rpc.Api.EventFilter[] = [
    { type: "contract", contractIds: [contractId] },
  ];

  let request: rpc.Api.GetEventsRequest;
  if (options.cursor !== undefined) {
    request = { filters, cursor: options.cursor, limit };
  } else {
    let startLedger = options.startLedger;
    if (startLedger === undefined) {
      const latest = await server.getLatestLedger();
      startLedger = Math.max(
        1,
        latest.sequence - DEFAULT_HISTORY_LOOKBACK_LEDGERS,
      );
    }
    request = { filters, startLedger, limit };
  }

  const response = await server.getEvents(request);
  const events: ContractEvent[] = [];
  for (const raw of response.events) {
    const decoded = decodeEvent(contractId, raw);
    if (decoded) {
      events.push(decoded);
    }
  }
  return { events, cursor: response.cursor };
}

/**
 * Fetches historical events emitted by a contract.
 * @param contractId Contract address to filter on.
 * @param startLedger Optional earliest ledger to scan from.
 */
export async function fetchEvents(
  contractId: string,
  startLedger?: number,
): Promise<ContractEvent[]> {
  const page = await fetchEventsPage(
    contractId,
    startLedger === undefined ? {} : { startLedger },
  );
  return page.events;
}

/* ------------------------------ subscribe ------------------------------- */

export interface SubscribeOptions {
  /** Delay between polls (default `DEFAULT_POLL_INTERVAL_MS`). */
  intervalMs?: number;
  /**
   * Resume from this RPC cursor. Pass the cursor of the last page you already
   * displayed so the first poll delivers only genuinely new events.
   */
  startCursor?: string;
  /** Called when a poll fails (e.g. RPC down) — polling continues. */
  onError?: (err: unknown) => void;
}

/**
 * Subscribes to live events via HONEST POLLING (Soroban RPC has no push
 * channel — this is not a websocket). Polls `getEvents` every `intervalMs`,
 * advancing the RPC cursor so `onEvent` fires once per new event, and returns
 * an unsubscribe function that clears the interval.
 *
 * Exactly-once caveat: the cursor only advances on success. If the FIRST poll
 * fails (RPC down at subscribe time), the next poll re-scans the recent
 * history window and may re-deliver events to a raw consumer — consumers
 * needing strict exactly-once delivery should dedupe (as `useContractEvents`
 * does with ledger:txHash:topic keys).
 */
export function subscribeToEvents(
  contractId: string,
  onEvent: EventListener,
  options: SubscribeOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let stopped = false;
  let cursor: string | null = options.startCursor ?? null;
  let inFlight = false;

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    try {
      const page = await fetchEventsPage(
        contractId,
        cursor === null ? {} : { cursor },
      );
      // Unsubscribed while the poll was in flight? Deliver nothing.
      if (stopped) {
        return;
      }
      cursor = page.cursor;
      for (const event of page.events) {
        if (stopped) {
          return; // don't deliver in-flight events after unsubscribe
        }
        onEvent(event);
      }
    } catch (err) {
      // Transient RPC failures shouldn't kill the feed — report and keep going.
      if (!stopped) {
        options.onError?.(err);
      }
    } finally {
      inFlight = false;
    }
  };

  // Poll immediately, then on the interval.
  void tick();
  const interval = window.setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}

/* ------------------------------ decoding -------------------------------- */

/**
 * Decodes one raw RPC event into a `ContractEvent`, or returns null when it
 * isn't a contract event we recognize (unknown topic, failed call, etc.).
 */
function decodeEvent(
  contractId: string,
  raw: rpc.Api.EventResponse,
): ContractEvent | null {
  // Only events from successful contract calls — skip system/diagnostic noise.
  if (raw.type !== "contract" || !raw.inSuccessfulContractCall) {
    return null;
  }

  const topicScVal = raw.topic[0];
  if (!topicScVal) {
    return null;
  }
  const name = scValToNative(topicScVal);
  if (typeof name !== "string" || !ALL_EVENT_NAMES.has(name)) {
    return null;
  }
  const topic = name as ContractEventName;

  const decodedValue = scValToNative(raw.value);
  if (!Array.isArray(decodedValue)) {
    return null;
  }
  const fields = decodedValue as unknown[];

  const base = {
    contractId,
    ledger: raw.ledger,
    topic,
    txHash: raw.txHash,
    timestamp: 0,
  };

  // Field order per contracts/*/src/events.rs (documented per case).
  switch (topic) {
    case "FUNDS_DEPOSITED": {
      // [project_id, client, amount, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          client: toAddressString(fields[1]),
          amount: toStroopsString(fields[2]),
          timestamp,
        },
      };
    }
    case "MILESTONE_CREATED": {
      // [project_id, milestone_id, amount, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          amount: toStroopsString(fields[2]),
          timestamp,
        },
      };
    }
    case "MILESTONE_SUBMITTED": {
      // [project_id, milestone_id, freelancer, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          freelancer: toAddressString(fields[2]),
          timestamp,
        },
      };
    }
    case "MILESTONE_APPROVED": {
      // [project_id, milestone_id, client, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          client: toAddressString(fields[2]),
          timestamp,
        },
      };
    }
    case "PAYMENT_RELEASED": {
      // [project_id, milestone_id, freelancer, amount, timestamp]
      const timestamp = toNumber(fields[4]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          freelancer: toAddressString(fields[2]),
          amount: toStroopsString(fields[3]),
          timestamp,
        },
      };
    }
    case "DISPUTE_OPENED": {
      // [project_id, milestone_id, initiator, reason, timestamp]
      // `reason` is a soroban String — decodes straight to a JS string.
      const timestamp = toNumber(fields[4]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          initiator: toAddressString(fields[2]),
          reason: String(fields[3]),
          timestamp,
        },
      };
    }
    case "DISPUTE_RESOLVED": {
      // [project_id, dispute_id, outcome(u32 enum), timestamp]
      const timestamp = toNumber(fields[3]);
      const outcome = OUTCOME_NAMES[toNumber(fields[2])];
      if (outcome === undefined) {
        return null; // unknown enum value — don't guess the outcome
      }
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          disputeId: toNumber(fields[1]),
          outcome,
          timestamp,
        },
      };
    }
    case "PROJECT_CANCELLED": {
      // [project_id, caller, timestamp]
      const timestamp = toNumber(fields[2]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          caller: toAddressString(fields[1]),
          timestamp,
        },
      };
    }
    case "REFUND_ISSUED": {
      // [project_id, client, amount, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          client: toAddressString(fields[1]),
          amount: toStroopsString(fields[2]),
          timestamp,
        },
      };
    }
    case "PROJECT_COMPLETED": {
      // [project_id, timestamp]
      const timestamp = toNumber(fields[1]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: { projectId: toNumber(fields[0]), timestamp },
      };
    }
    case "FUNDS_HELD": {
      // [project_id, milestone_id, from, amount, timestamp]
      const timestamp = toNumber(fields[4]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          from: toAddressString(fields[2]),
          amount: toStroopsString(fields[3]),
          timestamp,
        },
      };
    }
    case "FUNDS_RELEASED": {
      // [project_id, milestone_id, to, amount, timestamp]
      const timestamp = toNumber(fields[4]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          milestoneId: toNumber(fields[1]),
          to: toAddressString(fields[2]),
          amount: toStroopsString(fields[3]),
          timestamp,
        },
      };
    }
    case "FUNDS_REFUNDED": {
      // [project_id, to, amount, timestamp]
      const timestamp = toNumber(fields[3]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          to: toAddressString(fields[1]),
          amount: toStroopsString(fields[2]),
          timestamp,
        },
      };
    }
    case "PROJECT_CREATED": {
      // [project_id, client, freelancer, total_amount, timestamp]
      const timestamp = toNumber(fields[4]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          client: toAddressString(fields[1]),
          freelancer: toAddressString(fields[2]),
          totalAmount: toStroopsString(fields[3]),
          timestamp,
        },
      };
    }
    case "PROJECT_PAUSED": {
      // [project_id, admin, timestamp]
      const timestamp = toNumber(fields[2]);
      return {
        ...base,
        topic, // narrowed to the case literal — keeps the union member exact
        timestamp,
        data: {
          projectId: toNumber(fields[0]),
          admin: toAddressString(fields[1]),
          timestamp,
        },
      };
    }
  }

  // Unreachable for known topics (exhaustive switch); defensive null.
  return null;
}
