/**
 * Transaction status panel — redesigned with premium colors.
 *
 * Renders each lifecycle stage distinctly: building, simulating, signing,
 * submitted, pending, confirmed, and failed.
 */

import type { SVGProps } from "react";
import { shortenAddress } from "@/utils/format";
import type { TxState } from "@/types/transaction";

interface TxStatusPanelProps {
  state: TxState;
  hash: string | null;
  error: string | null;
  label?: string;
  onRetry?: () => void;
}

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
      className={`rounded-xl border p-4 ${
        state === "confirmed"
          ? "border-success-500/20 bg-success-500/5"
          : state === "failed"
            ? "border-error-500/20 bg-error-500/5"
            : "border-border-default bg-surface-2/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <StageIcon state={state} />
        <div className="min-w-0 flex-1">
          <div role="status" aria-live="polite">
            <p
              className={`text-[13px] font-semibold ${
                state === "confirmed"
                  ? "text-success-300"
                  : state === "failed"
                    ? "text-error-300"
                    : "text-text-primary"
              }`}
            >
              {stageTitle(state, label)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
              {stageDetail(state)}
            </p>
            {state === "failed" && error && (
              <p className="mt-2 text-[11px] leading-relaxed text-error-300/90">
                {error}
              </p>
            )}
          </div>

          {hash &&
            state !== "building" &&
            state !== "simulating" &&
            state !== "signing" && (
              <p className="mt-2 text-[11px]">
                <ExplorerLink hash={hash} />
              </p>
            )}

          {state === "failed" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-all duration-200 hover:border-border-strong hover:bg-surface-4 hover:text-text-primary"
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
      className="font-mono text-accent-400 underline decoration-accent-500/30 underline-offset-2 transition-colors hover:text-accent-300"
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
        <span className="text-success-400" aria-hidden="true">
          <svg {...shared} className={base}>
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span className="text-error-400" aria-hidden="true">
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
        <span className="animate-pulse text-warning-400" aria-hidden="true">
          <svg {...shared} className={base}>
            <path d="M12 3v9l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
      );
    case "signing":
      return (
        <span className="animate-pulse text-accent-400" aria-hidden="true">
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
        <span className="animate-pulse text-text-secondary" aria-hidden="true">
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
