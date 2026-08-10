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
