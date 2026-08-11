/**
 * Dispute records for the Phase 13 dispute UI.
 *
 * The escrow contract exposes NO public dispute reads (`read_dispute` is
 * private and there is no `get_dispute` / `get_dispute_count`), so dispute
 * history is reconstructed from escrow events:
 *
 *   - `DISPUTE_OPENED`  → [project_id, milestone_id, initiator, reason, timestamp]
 *   - `DISPUTE_RESOLVED` → [project_id, dispute_id, outcome, timestamp]
 *
 * Known data-model gaps (handled honestly, not papered over):
 *   - `DISPUTE_OPENED` does NOT carry `dispute_id`. Dispute ids are a global
 *     u32 counter on the escrow contract, so for an OPEN dispute the UI can
 *     only approximate the id from the 1-based position of the opened event
 *     within the loaded history window. The `DISPUTE_RESOLVED` event carries
 *     the authoritative id and replaces the approximation once it lands.
 *   - A project can host at most ONE dispute: `open_dispute` requires an
 *     Active project, and resolution moves it to Completed/Cancelled forever.
 *     Opened↔resolved pairing is therefore safe on `projectId`.
 */

import type { DisputeOutcome } from "@/types/event";

/** UI status of a dispute. */
export type DisputeStatus = "open" | "resolved";

/** A dispute reconstructed from escrow events (see module docs for gaps). */
export interface DisputeRecord {
  /** u32 — project the disputed milestone belongs to. */
  projectId: number;
  /** u32 — disputed milestone id (0 when only a resolved event was seen). */
  milestoneId: number;
  /**
   * u32 — on-chain dispute id. Authoritative once a `DISPUTE_RESOLVED` event
   * for this project is seen; otherwise the derived 1-based event-order
   * approximation (see module docs).
   */
  disputeId: number | null;
  /**
   * False when `disputeId` is the order-derived approximation (the opened
   * event does not carry the id) — resolution with a derived id can be
   * rejected by the escrow if the case predates the history window. UI must
   * label such ids as approximate.
   */
  disputeIdAuthoritative: boolean;
  /** Address that called `open_dispute` ("" when the opening fell out of window). */
  initiator: string;
  /** soroban String reason sent to `open_dispute` ("" when unknown). */
  reason: string;
  /** u64 unix seconds — when the dispute was opened (0 when unknown). */
  openedAt: number;
  openedLedger: number;
  openedTxHash: string;
  resolved: boolean;
  /** Outcome from `DISPUTE_RESOLVED`; null while open. */
  outcome: DisputeOutcome | null;
  /** u64 unix seconds — when `resolve_dispute` landed; null while open. */
  resolvedAt: number | null;
  resolvedLedger: number | null;
  resolvedTxHash: string | null;
}
