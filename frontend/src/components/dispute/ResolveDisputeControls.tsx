/**
 * Arbitrator-only dispute resolution controls (Phase 13).
 *
 * Calls the escrow contract's `resolve_dispute(arbitrator, dispute_id,
 * release_to_freelancer)` through the REAL `useTransaction` lifecycle (build →
 * simulate → sign → submit → poll) — the outcome only changes on-chain.
 *
 * Authorization is checked twice, not just hidden in the UI:
 *   1. UI gate — the escrow contract authorizes the caller with
 *      `require_factory_admin` (caller must equal the factory address stored
 *      at initialize). The configured `CONTRACTS.factory` IS that stored
 *      value, so `wallet.address === CONTRACTS.factory` mirrors the on-chain
 *      check. Non-arbitrators render nothing.
 *   2. Contract gate — even for an authorized UI, the real simulation runs
 *      `resolve_dispute` and reverts with `Unauthorized`/`InvalidState`
 *      otherwise, surfacing a plain-language error.
 *
 * Renders nothing while a dispute is resolved, or when the on-chain dispute
 * id is unknown (`DisputeRecord.disputeId === null` — the opened event does
 * not carry it; see types/dispute.ts).
 */

import { useState } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { TxStatusPanel } from "@/components/transaction/TxStatusPanel";
import { CONTRACTS } from "@/config/contracts";
import { useTransaction } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { getEscrowContract } from "@/services/contracts";
import { buildTx, toScVal } from "@/services/transactions";
import type { DisputeRecord } from "@/types/dispute";

interface ResolveDisputeControlsProps {
  dispute: DisputeRecord;
}

// Phase 15: `min-h-11 sm:min-h-0` keeps wallet/action buttons ≥44px on phones
// while restoring the original desktop height; `flex-1 sm:flex-none` stretches
// them full-width on mobile.
const RELEASE_BUTTON_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:flex-none";
const REFUND_BUTTON_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:flex-none";

export function ResolveDisputeControls({
  dispute,
}: ResolveDisputeControlsProps) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [lastOutcome, setLastOutcome] = useState<
    "released" | "refunded" | null
  >(null);

  // Mirror of the contract's require_factory_admin check against the stored
  // factory address (see module docs). Only the arbitrator sees controls.
  const canResolve = Boolean(address) && address === CONTRACTS.factory;

  if (!canResolve || dispute.resolved || dispute.disputeId === null) {
    return null;
  }

  const busy =
    tx.state !== "idle" &&
    tx.state !== "confirmed" &&
    tx.state !== "failed";

  async function resolve(releaseToFreelancer: boolean): Promise<void> {
    if (!address || busy) return;
    // Drive the full lifecycle (build → simulate → sign → submit → poll); the
    // outcome is surfaced through `tx.state`/`tx.hash`/`tx.error` below, so the
    // return value is intentionally unused.
    await tx.execute(() =>
      buildTx({
        contract: getEscrowContract(),
        method: "resolve_dispute",
        args: [
          toScVal(address),
          nativeToScVal(dispute.disputeId as number, { type: "u32" }),
          toScVal(releaseToFreelancer),
        ],
        source: address,
      }),
    );
    setLastOutcome(releaseToFreelancer ? "released" : "refunded");
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
        Arbitrator actions
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        You are the escrow's arbitrator (factory address). Resolving releases
        the disputed milestone payment to the freelancer or refunds it to the
        client — this moves real funds on-chain.
      </p>
      {!dispute.disputeIdAuthoritative && (
        <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
          This case's dispute id is derived from recent event order (the opened
          event doesn't carry it). If the case predates the history window, the
          escrow will reject the wrong id in simulation.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve(true)}
          className={RELEASE_BUTTON_CLASS}
        >
          <CheckIcon className="h-3.5 w-3.5" />
          Release to freelancer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolve(false)}
          className={REFUND_BUTTON_CLASS}
        >
          <RefundIcon className="h-3.5 w-3.5" />
          Refund to client
        </button>
      </div>

      {tx.state !== "idle" && (
        <div className="mt-3">
          <TxStatusPanel
            state={tx.state}
            hash={tx.hash}
            error={tx.error}
            label="Resolve dispute"
            onRetry={
              tx.state === "failed"
                ? () =>
                    void resolve(lastOutcome === "refunded" ? false : true)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function RefundIcon({ className }: { className?: string }) {
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  );
}
