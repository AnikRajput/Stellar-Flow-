/**
 * Open dispute modal (Phase 13).
 *
 * Collects the dispute reason and calls the escrow contract's
 * `open_dispute(initiator, project_id, milestone_id, reason)` through the
 * REAL `useTransaction` lifecycle — the dispute is only real once the
 * transaction confirms on-chain. The signer (`initiator`) is the connected
 * wallet; the contract itself enforces `require_project_participant` (client
 * or freelancer), so any other wallet fails in simulation with a plain-language
 * error rather than a fake success.
 *
 * Expected usage: launched from the milestone timeline's "Dispute" action on a
 * submitted milestone (the client's contested state), replacing the earlier
 * placeholder reason.
 */

import { useCallback, useEffect, useState } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { TxStatusPanel } from "@/components/transaction/TxStatusPanel";
import { useTransaction } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { getEscrowContract } from "@/services/contracts";
import { buildTx, toScVal } from "@/services/transactions";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";
import {
  explorerTxUrl,
  formatStroopsAsUnits,
  shortenAddress,
} from "@/utils/format";

interface OpenDisputeModalProps {
  project: Project;
  milestone: Milestone;
  onClose: () => void;
  /** Called after `open_dispute` confirms on-chain. */
  onOpened?: () => void;
}

const REASON_MAX_LENGTH = 500;

export function OpenDisputeModal({
  project,
  milestone,
  onClose,
  onOpened,
}: OpenDisputeModalProps) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const busy =
    tx.state !== "idle" &&
    tx.state !== "confirmed" &&
    tx.state !== "failed";

  // Escape closes the modal (only when nothing is in flight).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const openDispute = useCallback(async (): Promise<void> => {
    const trimmed = reason.trim();
    if (!address || busy || trimmed.length === 0) return;
    const result = await tx.execute(() =>
      buildTx({
        contract: getEscrowContract(),
        method: "open_dispute",
        args: [
          toScVal(address),
          nativeToScVal(project.id, { type: "u32" }),
          nativeToScVal(milestone.id, { type: "u32" }),
          toScVal(trimmed),
        ],
        source: address,
      }),
    );
    if (result.outcome === "confirmed") {
      setSubmitted(true);
      onOpened?.();
    }
  }, [address, busy, onOpened, project.id, milestone.id, reason, tx]);

  const canSubmit = !busy && reason.trim().length > 0 && Boolean(address);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      role="presentation"
    >
      {/* Backdrop click closes (only when idle). */}
      <button
        type="button"
        aria-label="Close dispute dialog"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-dispute-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-glow"
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <h2 id="open-dispute-title" className="text-base font-semibold text-ink-50">
            Open a dispute
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:min-w-0"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-ink-300">
            Project{" "}
            <span className="font-semibold text-ink-50">#{project.id}</span> ·{" "}
            Milestone{" "}
            <span className="font-semibold text-ink-50">
              {milestone.id} — {milestone.name}
            </span>{" "}
            ·{" "}
            <span className="tabular-nums">
              {formatStroopsAsUnits(milestone.amount)} XLM
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Opening a dispute pauses the project and holds the milestone funds
            in escrow until the arbitrator resolves it. Only the client or
            freelancer of this project can open one — the contract enforces
            this.
          </p>

          <label
            htmlFor="dispute-reason"
            className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-400"
          >
            Reason
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || submitted}
            autoFocus
            maxLength={REASON_MAX_LENGTH}
            rows={4}
            placeholder="Describe what went wrong with this milestone…"
            className="mt-1.5 w-full resize-y rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-ink-500">
            {reason.length}/{REASON_MAX_LENGTH}
          </p>

          {submitted && tx.state === "confirmed" && tx.hash && (
            <p className="mt-2 text-xs leading-relaxed text-emerald-200">
              Dispute opened on-chain.{" "}
              <a
                href={explorerTxUrl(tx.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-100"
              >
                View transaction
              </a>
            </p>
          )}

          {!submitted && tx.state !== "idle" && (
            <div className="mt-3">
              <TxStatusPanel
                state={tx.state}
                hash={tx.hash}
                error={tx.error}
                label="Open dispute"
                onRetry={tx.state === "failed" ? () => void openDispute() : undefined}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-800 px-5 py-4">
          {address && (
            <p className="mr-auto truncate font-mono text-xs text-ink-500" title={address}>
              {shortenAddress(address)}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0"
          >
            {submitted ? "Done" : "Cancel"}
          </button>
          {!submitted && (
            <button
              type="button"
              onClick={() => void openDispute()}
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none md:min-h-0"
            >
              Open dispute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
