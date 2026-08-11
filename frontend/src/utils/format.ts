/**
 * Shared display-formatting helpers.
 *
 * On-chain amounts arrive as `i128` string values denominated in stroops
 * (1 unit = 10^7 stroops). Amounts are formatted as XLM units because Stellar's
 * native asset is XLM; a per-token conversion is layered on once token metadata
 * reads land (Phase 9/11).
 */

/** 1 XLM (or 1 unit of any Soroban token) = 10^7 stroops. */
export const STROOPS_PER_UNIT = 10_000_000;

/** User-typed XLM amounts: whole part + up to 7 decimal places. */
const XLM_AMOUNT_RE = /^\d+(\.\d{1,7})?$/;

/**
 * True when `input` parses as a positive XLM amount (up to 7 decimals).
 * Used by wizard validation before anything reaches a contract.
 */
export function isValidXlmAmount(input: string): boolean {
  const trimmed = input.trim();
  if (!XLM_AMOUNT_RE.test(trimmed)) {
    return false;
  }
  // Reject "0", "0.0", "000", …
  return Number(trimmed) > 0;
}

/**
 * Converts a user-typed XLM amount (e.g. "1.5") to an exact stroop count.
 * Invalid input degrades to `0n`. Uses whole + padded-fraction arithmetic
 * (never `parseFloat * 1e7`) so sums like 0.1 + 0.2 are exact — the wizard
 * relies on this when requiring milestones to sum to the project total.
 */
export function xlmToStroops(input: string): bigint {
  const trimmed = input.trim();
  if (!XLM_AMOUNT_RE.test(trimmed)) {
    return 0n;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "0000000").slice(0, 7);
  return BigInt(whole) * BigInt(STROOPS_PER_UNIT) + BigInt(paddedFraction);
}

/**
 * Strictly parses an i128 stroop string. Malformed input degrades to `0n`
 * instead of throwing, so a bad on-chain value never crashes a page — balances
 * are non-negative in practice, and 0 is the safe display fallback.
 */
export function parseStroops(stroops: string): bigint {
  try {
    return BigInt(stroops);
  } catch {
    return 0n;
  }
}

/** Formats a stroop amount as XLM units (e.g. "1250000000" → "125"). */
export function formatStroopsAsUnits(stroops: string): string {
  return formatUnits(Number(parseStroops(stroops)) / STROOPS_PER_UNIT);
}

/** Formats a plain number with up to 7 fraction digits (unit display). */
export function formatUnits(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 7,
  }).format(amount);
}

/** "GABCDEFGHIJKLMNOPQRSTUVWXYZ" → "GABC…WXYZ" */
export function shortenAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" for a unix-seconds timestamp. */
export function relativeTime(epochSeconds: number): string {
  // 0 means "no timestamp" in event decoding — never render "20533d ago".
  if (epochSeconds <= 0) {
    return "—";
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Stellar Expert explorer URL for a transaction hash.
 * Testnet per the Phase 10/11/12 prompts; generalizing to the configured
 * network is deferred until explorer-network mapping lands.
 */
export function explorerTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}
