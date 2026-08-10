/**
 * Contract event shapes matching the event tables from Phases 3-5.
 *
 * Topic names are the `Symbol`s published by each contract's `publish_*`
 * helper. Field names are camelCase versions of the Rust struct fields.
 * Serialization notes shared with `project.ts` (i128 → string, u32/u64 → number,
 * Address → string).
 */

/** Every topic emitted by escrow, payment-vault, and project-factory. */
export type ContractEventName =
  // escrow
  | "FUNDS_DEPOSITED"
  | "MILESTONE_CREATED"
  | "MILESTONE_SUBMITTED"
  | "MILESTONE_APPROVED"
  | "PAYMENT_RELEASED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "PROJECT_CANCELLED"
  | "REFUND_ISSUED"
  | "PROJECT_COMPLETED"
  // payment-vault
  | "FUNDS_HELD"
  | "FUNDS_RELEASED"
  | "FUNDS_REFUNDED"
  // project-factory
  | "PROJECT_CREATED"
  | "PROJECT_PAUSED";

/** Rust `DisputeOutcome` enum (escrow DISPUTE_RESOLVED payload). */
export type DisputeOutcome = "ReleasedToFreelancer" | "RefundedToClient";

/* ------------------------------ escrow events ----------------------------- */

export interface FundsDepositedEventData {
  projectId: number; // u32
  client: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

export interface MilestoneCreatedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  amount: string; // i128
  timestamp: number; // u64
}

export interface MilestoneSubmittedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  freelancer: string; // Address
  timestamp: number; // u64
}

export interface MilestoneApprovedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  client: string; // Address
  timestamp: number; // u64
}

export interface PaymentReleasedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  freelancer: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

export interface DisputeOpenedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  initiator: string; // Address
  reason: string; // soroban String
  timestamp: number; // u64
}

export interface DisputeResolvedEventData {
  projectId: number; // u32
  disputeId: number; // u32
  outcome: DisputeOutcome;
  timestamp: number; // u64
}

export interface ProjectCancelledEventData {
  projectId: number; // u32
  caller: string; // Address
  timestamp: number; // u64
}

export interface RefundIssuedEventData {
  projectId: number; // u32
  client: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

export interface ProjectCompletedEventData {
  projectId: number; // u32
  timestamp: number; // u64
}

/* ---------------------------- payment-vault events ------------------------ */

export interface FundsHeldEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  from: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

export interface VaultFundsReleasedEventData {
  projectId: number; // u32
  milestoneId: number; // u32
  to: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

export interface VaultFundsRefundedEventData {
  projectId: number; // u32
  to: string; // Address
  amount: string; // i128
  timestamp: number; // u64
}

/* ---------------------------- project-factory events ---------------------- */

export interface ProjectCreatedEventData {
  projectId: number; // u32
  client: string; // Address
  freelancer: string; // Address
  totalAmount: string; // i128
  timestamp: number; // u64
}

export interface ProjectPausedEventData {
  projectId: number; // u32
  admin: string; // Address
  timestamp: number; // u64
}

/* --------------------------------- envelope ------------------------------- */

/** Metadata attached to every event fetched/subscribed by the events service. */
export interface ContractEventBase {
  /** Address of the contract that emitted the event. */
  contractId: string;
  /** Ledger sequence number the event was emitted in. */
  ledger: number;
  /** Publishing contract's event topic (Symbol). */
  topic: ContractEventName;
  /** Hash of the transaction that emitted the event. */
  txHash: string;
  /** Ledger close time (u64) — unix seconds. */
  timestamp: number;
}

/** Discriminated union keyed by `topic`. */
export type ContractEvent =
  | (ContractEventBase & { topic: "FUNDS_DEPOSITED"; data: FundsDepositedEventData })
  | (ContractEventBase & { topic: "MILESTONE_CREATED"; data: MilestoneCreatedEventData })
  | (ContractEventBase & { topic: "MILESTONE_SUBMITTED"; data: MilestoneSubmittedEventData })
  | (ContractEventBase & { topic: "MILESTONE_APPROVED"; data: MilestoneApprovedEventData })
  | (ContractEventBase & { topic: "PAYMENT_RELEASED"; data: PaymentReleasedEventData })
  | (ContractEventBase & { topic: "DISPUTE_OPENED"; data: DisputeOpenedEventData })
  | (ContractEventBase & { topic: "DISPUTE_RESOLVED"; data: DisputeResolvedEventData })
  | (ContractEventBase & { topic: "PROJECT_CANCELLED"; data: ProjectCancelledEventData })
  | (ContractEventBase & { topic: "REFUND_ISSUED"; data: RefundIssuedEventData })
  | (ContractEventBase & { topic: "PROJECT_COMPLETED"; data: ProjectCompletedEventData })
  | (ContractEventBase & { topic: "FUNDS_HELD"; data: FundsHeldEventData })
  | (ContractEventBase & { topic: "FUNDS_RELEASED"; data: VaultFundsReleasedEventData })
  | (ContractEventBase & { topic: "FUNDS_REFUNDED"; data: VaultFundsRefundedEventData })
  | (ContractEventBase & { topic: "PROJECT_CREATED"; data: ProjectCreatedEventData })
  | (ContractEventBase & { topic: "PROJECT_PAUSED"; data: ProjectPausedEventData });
