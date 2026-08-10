/**
 * Wallet connection button.
 *
 * Renders four states with distinct visual treatment — never a bare
 * "Connect" button with no feedback:
 *
 *   - disconnected → primary "Connect Wallet" action
 *   - connecting   → disabled button with a spinner
 *   - connected    → shortened address (GABC…WXYZ) with copy-to-clipboard
 *   - error        → red-flagged button + human-readable message
 *
 * The `wallet` object comes from `useWallet()` so this button is driven by
 * the same state the rest of the app reads.
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
      // Clipboard unavailable (e.g. insecure context) — no fake success.
      setCopied(false);
    }
  }

  if (status === "connecting") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-wait items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-400"
      >
        <SpinnerIcon />
        Connecting…
      </button>
    );
  }

  if (status === "connected" && address) {
    // Connected on the wrong network is still an error state: keep the
    // address visible but flag it with a warning treatment + message.
    const wrongNetwork = error?.code === "wrong-network";
    return (
      <div className="inline-flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${
              wrongNetwork
                ? "border-accent-500/40 bg-accent-500/10"
                : "border-ink-700 bg-ink-800"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${wrongNetwork ? "bg-accent-400" : "bg-emerald-400"}`}
              aria-hidden="true"
            />
            <span className="font-mono text-sm font-medium text-ink-100">
              {shortenAddress(address)}
            </span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              title="Copy full address"
              className="rounded-md px-1.5 py-0.5 text-xs font-medium text-navy-300 transition-colors hover:bg-ink-700 hover:text-navy-200"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={disconnect}
            className="rounded-lg px-2 py-2 text-xs font-medium text-ink-400 transition-colors hover:text-red-300"
          >
            Disconnect
          </button>
        </div>
        {wrongNetwork && (
          <p role="alert" className="max-w-xs text-center text-xs leading-relaxed text-accent-300">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  // disconnected (with or without an error) — show the message, not raw SDK text
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void connect()}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
          error
            ? "border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            : "bg-navy-600 text-white shadow-glow hover:bg-navy-500"
        }`}
      >
        <WalletIcon />
        {error ? "Try again" : "Connect Wallet"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-center text-xs leading-relaxed text-red-300">
          {error.message}
        </p>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-ink-300"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
