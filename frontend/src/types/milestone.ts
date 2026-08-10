/**
 * Mirrors `contracts/escrow/src/types.rs`.
 * Serialization notes shared with `project.ts` (i128 → string, u32/u64 → number).
 */

/** Rust `MilestoneStatus` enum (contracts/escrow/src/types.rs). */
export type MilestoneStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "paid"
  | "disputed"
  | "cancelled";

/** Rust `Milestone` struct (contracts/escrow/src/types.rs). */
export interface Milestone {
  /** u32 — id within the project */
  id: number;
  /** soroban String — display name */
  name: string;
  /** i128 — milestone payout amount in stroops */
  amount: string;
  status: MilestoneStatus;
  /** u64 — unix seconds */
  dueDate: number;
}
