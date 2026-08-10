/**
 * Shared types + validation for the Create Project wizard (Phase 9).
 *
 * Amounts are kept as the raw strings the user typed (XLM units) and parsed to
 * exact stroops via `xlmToStroops` — never floats — so the wizard's
 * "milestones must sum to the project total" rule mirrors the escrow contract's
 * own invariant (add_milestone panics AmountMismatch when the running sum
 * exceeds total_amount).
 */

import { isValidXlmAmount, xlmToStroops } from "@/utils/format";

export interface MilestoneDraft {
  /** Stable local key — never sent to the contract. */
  id: string;
  name: string;
  /** XLM units, exactly as typed (e.g. "1.5"). */
  amount: string;
  /** YYYY-MM-DD from <input type="date">. */
  dueDate: string;
}

export interface ProjectDraft {
  /** Off-chain metadata — the escrow Project struct stores no title. */
  name: string;
  description: string;
  /** Freelancer Stellar public key (G...). */
  freelancer: string;
  /** Token contract id (C...). */
  token: string;
  /** XLM units, exactly as typed. */
  totalAmount: string;
  milestones: MilestoneDraft[];
}

let milestoneSeq = 0;

/** New empty milestone row with a stable, unique local id. */
export function createEmptyMilestone(): MilestoneDraft {
  milestoneSeq += 1;
  return {
    id: `m-${Date.now().toString(36)}-${milestoneSeq}`,
    name: "",
    amount: "",
    dueDate: "",
  };
}

export function createInitialDraft(token: string): ProjectDraft {
  return {
    name: "",
    description: "",
    freelancer: "",
    token,
    totalAmount: "",
    milestones: [createEmptyMilestone()],
  };
}

/** Stellar account strkey: G + 55 base32 chars (alphabet excludes 0/O/I/L). */
const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

export function isPublicKey(value: string): boolean {
  return PUBLIC_KEY_RE.test(value.trim());
}

export function isBasicsValid(name: string): boolean {
  return name.trim().length > 0;
}

export interface PartiesValidation {
  ok: boolean;
  /** Format is a valid G... strkey (may still be the client's own wallet). */
  formatOk: boolean;
  /** True when the freelancer equals the connected client wallet. */
  selfAddress: boolean;
  /** Human error shown under the input (undefined while empty/valid). */
  error?: string;
}

export function validateParties(
  freelancer: string,
  clientAddress: string | null,
): PartiesValidation {
  const value = freelancer.trim();
  const formatOk = isPublicKey(value);
  const selfAddress =
    clientAddress !== null && value !== "" && value === clientAddress;

  if (selfAddress) {
    return {
      ok: false,
      formatOk,
      selfAddress,
      error:
        "The freelancer must be a different wallet than the one you're connected with.",
    };
  }
  if (value !== "" && !formatOk) {
    return {
      ok: false,
      formatOk,
      selfAddress,
      error:
        "Enter a valid Stellar public key — G followed by 55 base32 characters.",
    };
  }
  return { ok: formatOk && value !== "", formatOk, selfAddress };
}

export interface MilestoneRowErrors {
  name?: string;
  amount?: string;
  dueDate?: string;
}

export interface MilestonesValidation {
  ok: boolean;
  hasRows: boolean;
  /** Every row has a name, a positive amount, and a due date. */
  rowsOk: boolean;
  /** The project total is a valid positive XLM amount. */
  totalOk: boolean;
  /** Sum of parsed milestone amounts in stroops (invalid rows count as 0). */
  runningStroops: bigint;
  /** Parsed project total in stroops (0n when invalid). */
  totalStroops: bigint;
  /** runningStroops - totalStroops (0n when equal). */
  mismatchStroops: bigint;
  rowErrors: Readonly<Record<string, MilestoneRowErrors>>;
}

export function validateMilestones(
  milestones: MilestoneDraft[],
  totalAmount: string,
): MilestonesValidation {
  const rowErrors: Record<string, MilestoneRowErrors> = {};
  let runningStroops = 0n;
  let rowsOk = true;

  for (const milestone of milestones) {
    const errors: MilestoneRowErrors = {};
    if (!milestone.name.trim()) {
      errors.name = "Name is required.";
    }
    if (!isValidXlmAmount(milestone.amount)) {
      errors.amount = "Enter a positive amount (up to 7 decimals).";
    }
    if (!milestone.dueDate) {
      errors.dueDate = "Pick a due date.";
    }
    if (Object.keys(errors).length > 0) {
      rowsOk = false;
    }
    rowErrors[milestone.id] = errors;
    runningStroops += xlmToStroops(milestone.amount);
  }

  const hasRows = milestones.length > 0;
  const totalOk = isValidXlmAmount(totalAmount);
  const totalStroops = xlmToStroops(totalAmount);
  const mismatchStroops = runningStroops - totalStroops;

  return {
    ok: hasRows && rowsOk && totalOk && mismatchStroops === 0n,
    hasRows,
    rowsOk,
    totalOk,
    runningStroops,
    totalStroops,
    mismatchStroops,
    rowErrors,
  };
}

/** "2026-09-01" → "Sep 1, 2026" (falls back to the raw string). */
export function formatDueDate(dateStr: string): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    return dateStr;
  }
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
