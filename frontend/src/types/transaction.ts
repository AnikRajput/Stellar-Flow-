/**
 * Transaction lifecycle + on-chain contract error codes.
 *
 * The error maps mirror the `#[contracterror]` enums (repr(u32)) from the three
 * contracts so frontend code can translate Soroban `ContractError` codes into
 * human-readable messages.
 */

/** UI lifecycle of a contract transaction. */
export type TxState =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitted"
  | "pending"
  | "confirmed"
  | "failed";

/** contracts/escrow/src/errors.rs (1..=10). */
export const escrowErrorMessages: Readonly<Record<number, string>> = {
  1: "Unauthorized",
  2: "ProjectNotFound",
  3: "MilestoneNotFound",
  4: "InvalidAmount",
  5: "InvalidState",
  6: "AlreadyPaid",
  7: "AmountMismatch",
  8: "ProjectPaused",
  9: "ProjectNotActive",
  10: "SelfApprovalNotAllowed",
};

/** contracts/payment-vault/src/errors.rs (1..=3). */
export const vaultErrorMessages: Readonly<Record<number, string>> = {
  1: "Unauthorized",
  2: "InvalidAmount",
  3: "InsufficientBalance",
};

/** contracts/project-factory/src/errors.rs (1, 2, 4). */
export const factoryErrorMessages: Readonly<Record<number, string>> = {
  1: "Unauthorized",
  2: "ProjectNotFound",
  4: "InvalidAmount",
};
