/**
 * WalletGuard gates wallet-dependent UI behind a connected Freighter wallet.
 *
 * While the wallet is disconnected or on the wrong network, children are NOT
 * rendered. Instead a clear, actionable prompt is shown:
 *
 *   - Freighter not installed  → install instructions (via WalletButton error)
 *   - disconnected             → "Connect your wallet" prompt
 *   - wrong network            → "Switch to Testnet" prompt
 *
 * Children render only once the wallet is connected on the expected network
 * (the network configured via `VITE_STELLAR_NETWORK`).
 */

import type { ReactNode } from "react";
import { EXPECTED_NETWORK_LABEL, useWallet } from "@/hooks/useWallet";
import { WalletButton } from "@/components/wallet/WalletButton";

interface WalletGuardProps {
  children: ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const wallet = useWallet();
  const { status, error } = wallet;

  const wrongNetwork = status === "connected" && error?.code === "wrong-network";
  const unlocked = status === "connected" && !wrongNetwork;

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900/80 p-8 text-center shadow-glow">
        <div
          className={`mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${
            wrongNetwork ? "bg-accent-500/15 text-accent-300" : "bg-navy-600/20 text-navy-300"
          }`}
        >
          {wrongNetwork ? <NetworkIcon /> : <LockIcon />}
        </div>

        <h2 className="text-lg font-semibold text-ink-50">
          {wrongNetwork ? `Switch to ${EXPECTED_NETWORK_LABEL}` : "Connect your wallet"}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          {wrongNetwork ? (
            <>
              StellarFlow runs on the {EXPECTED_NETWORK_LABEL} network, but your wallet is
              connected to a different one. Open Freighter → Settings → Network, switch to{" "}
              {EXPECTED_NETWORK_LABEL}, then reconnect.
            </>
          ) : (
            "Connect your Freighter wallet to create projects, fund escrow, and release milestone payments."
          )}
        </p>

        <div className="mt-6 flex justify-center">
          <WalletButton wallet={wallet} />
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
