/**
 * Mirrors `contracts/escrow/src/types.rs`.
 *
 * Soroban → TS serialization notes (apply to all type files):
 * - `u32`/`u64` scalars → `number` (safe range for ids / timestamps)
 * - `i128` amounts → `string` (avoids JS number precision loss on large values)
 * - `Address` → `string` (G.../C... public key)
 */

/** Rust `ProjectStatus` enum (contracts/escrow/src/types.rs). */
export type ProjectStatus =
  | "active"
  | "completed"
  | "disputed"
  | "cancelled"
  | "paused";

/** Rust `Project` struct (contracts/escrow/src/types.rs). */
export interface Project {
  /** u32 */
  id: number;
  /** Address — project owner / payer */
  client: string;
  /** Address — milestone worker / payee */
  freelancer: string;
  /** Address — token used for this project's payments */
  token: string;
  /** i128 — total project value in stroops */
  totalAmount: string;
  /** i128 — currently escrowed amount in stroops */
  escrowBalance: string;
  status: ProjectStatus;
  /** u32 */
  milestoneCount: number;
  /** u64 — unix seconds */
  createdAt: number;
}
