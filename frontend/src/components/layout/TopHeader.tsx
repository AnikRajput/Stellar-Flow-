/**
 * TopHeader — sticky professional header with breadcrumbs, wallet pill,
 * and primary action button. Only shown on desktop.
 */

import { useState } from "react";
import type { UseWalletReturn } from "@/hooks/useWallet";
import { shortenAddress } from "@/utils/format";

interface TopHeaderProps {
  /** Page title for breadcrumb. */
  title: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Wallet state from useWallet(). */
  wallet: UseWalletReturn;
  /** Primary action button. */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function TopHeader({
  title,
  subtitle,
  wallet,
  action,
}: TopHeaderProps) {
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

  const isConnected = status === "connected" && address;
  const isConnecting = status === "connecting";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-0/80 px-6 py-3 backdrop-blur-xl lg:px-8">
      {/* Left: title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-text-tertiary">{subtitle}</p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Primary action */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-accent-gradient px-4 py-2 text-[13px] font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 active:scale-[0.98]"
          >
            {action.icon}
            {action.label}
          </button>
        )}

        {/* Wallet pill */}
        {isConnected ? (
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                error?.code === "wrong-network"
                  ? "border-warning-500/30 bg-warning-500/5 text-warning-300"
                  : "border-border-default bg-surface-2/80 text-text-primary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  error?.code === "wrong-network"
                    ? "bg-warning-400"
                    : "bg-success-400"
                }`}
                aria-hidden="true"
              />
              <span className="font-mono text-xs">{shortenAddress(address)}</span>
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
        ) : isConnecting ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-2/80 px-3 py-1.5 text-[13px] text-text-tertiary">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Connecting...
          </div>
        ) : (
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
        )}
      </div>
    </header>
  );
}
