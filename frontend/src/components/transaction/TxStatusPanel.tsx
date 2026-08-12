/**
 * Transaction status panel (Phase 11).
 *
 * Renders each lifecycle stage distinctly: building, simulating, signing
 * (Freighter popup), submitted (hash becomes linkable), pending (polling),
 * confirmed, and failed (plain-language reason + Try Again). Errors arrive
 * already human-readable from `useTransaction`/`friendlyErrorMessage` — raw
 * stack traces are never displayed.
 *
 * The explorer link uses the Testnet URL specified by the Phase 11 prompt
 * (`https://stellar.expert/explorer/testnet/tx/{hash}`); generalizing it to
 * the configured network is deferred until explorer-network mapping lands.
 */

import type { SVGProps } from "react";
import { shortenAddress } from "@/utils/format";
import type { TxState } from "@/types/transaction";

interface TxStatusPanelProps {
  state: TxState;
  hash: string | null;
  error: string | null;
  /** Short label of the action being run (e.g. "Submit milestone"). */
  label?: string;
  /** Re-runs the failed action — renders the "Try Again" button. */
  onRetry?: () => void;
}

/** Renders nothing until a transaction is actually in flight. */
export function TxStatusPanel({
  state,
  hash,
  error,
  label,
  onRetry,
}: TxStatusPanelProps) {
  if (state === "idle") {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        state === "confirmed"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : state === "failed"
            ? "border-red-500/30 bg-red-500/5"
            : "border-ink-700 bg-ink-900/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <StageIcon state={state} />
        <div className="min-w-0 flex-1">
          {/* Live region announces stage changes only — the explorer link and
              Try Again button stay outside it (interactive content inside an
              aria-live region is discouraged). */}
          <div role="status" aria-live="polite">
            <p
              className={`text-sm font-semibold ${
                state === "confirmed"
                  ? "text-emerald-200"
                  : state === "failed"
                    ? "text-red-200"
                    : "text-ink-100"
              }`}
            >
              {stageTitle(state, label)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              {stageDetail(state)}
            </p>
            {state === "failed" && error && (
              <p className="mt-2 text-xs leading-relaxed text-red-200/90">
                {error}
              </p>
            )}
          </div>

          {hash &&
            state !== "building" &&
            state !== "simulating" &&
            state !== "signing" && (
              <p className="mt-2 text-xs">
                <ExplorerLink hash={hash} />
              </p>
            )}

          {state === "failed" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:bg-ink-700 hover:text-ink-50 md:min-h-0"
            >
              <RetryIcon className="h-3.5 w-3.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function stageTitle(state: TxState, label?: string): string {
  const prefix = label ? `${label} — ` : "";
  switch (state) {
    case "building":
      return `${prefix}Building transaction`;
    case "simulating":
      return `${prefix}Simulating on-chain`;
    case "signing":
      return `${prefix}Waiting for your signature`;
    case "submitted":
      return `${prefix}Transaction submitted`;
    case "pending":
      return `${prefix}Waiting for confirmation`;
    case "confirmed":
      return `${prefix}Confirmed on-chain`;
    case "failed":
      return `${prefix}Transaction failed`;
    case "idle":
      return "";
  }
}

function stageDetail(state: TxState): string {
  switch (state) {
    case "building":
      return "Preparing the contract call for your wallet.";
    case "simulating":
      return "Checking that the contract accepts this transaction.";
    case "signing":
      return "Approve the request in the Freighter popup to continue.";
    case "submitted":
      return "Sent to the network — waiting for confirmation.";
    case "pending":
      return "The network is processing this transaction.";
    case "confirmed":
      return "The transaction was applied on-chain.";
    case "failed":
      return "The transaction could not complete.";
    case "idle":
      return "";
  }
}

function ExplorerLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      title={hash}
      className="font-mono text-navy-300 underline decoration-navy-500/40 underline-offset-2 transition-colors hover:text-navy-200"
    >
      {shortenAddress(hash)}
    </a>
  );
}

function StageIcon({ state }: { state: TxState }) {
  const shared: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const base = "mt-0.5 h-5 w-5 shrink-0";

  switch (state) {
    case "confirmed":
      return (
        <span className="text-emerald-300" aria-hidden="true">
          <svg {...shared} className={base}>
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span className="text-red-300" aria-hidden="true">
          <svg {...shared} className={base}>
            <circle cx="12" cy="12" r="9" />
            <path d="m9 9 6 6" />
            <path d="m15 9-6 6" />
          </svg>
        </span>
      );
    case "submitted":
    case "pending":
      return (
        <span className="animate-pulse text-amber-300" aria-hidden="true">
          <svg {...shared} className={base}>
            <path d="M12 3v9l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
      );
    case "signing":
      return (
        <span className="animate-pulse text-navy-300" aria-hidden="true">
          <svg {...shared} className={base}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      );
    case "building":
    case "simulating":
    default:
      return (
        <span className="animate-pulse text-ink-300" aria-hidden="true">
          <svg {...shared} className={base}>
            <path d="M12 3v9l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
      );
  }
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
