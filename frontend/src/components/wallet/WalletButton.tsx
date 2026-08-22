/**
 * Wallet connection button — redesigned for premium look.
 *
 * Four states: disconnected → connecting → connected → error.
 * Clean, compact pill design with copy functionality.
 */

import { useState } from "react";
import type { UseWalletReturn } from "@/hooks/useWallet";

interface WalletButtonProps {
  wallet: UseWalletReturn;
}

/** "GABCDEFGHIJKLMNOPQRSTUVWXYZ" → "GABC…WXYZ" */
function shortenAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

export function WalletButton({ wallet }: WalletButtonProps) {
  const { address, status, connect, disconnect, error } = wallet;
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (status === "connecting") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-2/80 px-3 py-1.5 text-[13px] text-text-tertiary">
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
        Connecting…
      </div>
    );
  }

  if (status === "connected" && address) {
    const wrongNetwork = error?.code === "wrong-network";
    return (
      <div className="inline-flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
              wrongNetwork
                ? "border-warning-500/30 bg-warning-500/5"
                : "border-border-default bg-surface-2/80"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                wrongNetwork ? "bg-warning-400" : "bg-success-400"
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-[13px] font-medium text-text-primary">
              {shortenAddress(address)}
            </span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              title="Copy full address"
              className="rounded px-1.5 py-0.5 text-[11px] text-accent-400 transition-colors hover:bg-surface-3 hover:text-accent-300"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={disconnect}
            className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-text-tertiary transition-colors hover:text-error-400"
          >
            Disconnect
          </button>
        </div>
        {wrongNetwork && (
          <p role="alert" className="max-w-xs text-center text-[11px] leading-relaxed text-warning-300">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  // disconnected (with or without an error)
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void connect()}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
          error
            ? "border border-error-500/30 bg-error-500/10 text-error-300 hover:bg-error-500/15"
            : "bg-accent-gradient text-white shadow-glow-sm hover:shadow-glow hover:brightness-110"
        }`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
        {error ? "Try again" : "Connect Wallet"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-center text-[11px] leading-relaxed text-error-300">
          {error.message}
        </p>
      )}
    </div>
  );
}
