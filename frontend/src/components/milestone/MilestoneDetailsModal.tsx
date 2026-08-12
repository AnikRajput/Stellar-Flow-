/**
 * Milestone details modal (Phase 10).
 *
 * Read-only record for one milestone: status, amount, due date, submission
 * note, approval record, payment state, and (when available) the payment
 * transaction hash linked to Stellar Expert's Testnet explorer.
 *
 * Honesty rules: the on-chain `Milestone` struct carries no submission note,
 * approval timestamp, or tx hash — those arrive with event reads (Phase 12) —
 * so the modal renders "—" with an honest context line instead of inventing
 * values. The `txHash` prop is accepted now so Phase 12 can pass it through
 * without changing this component's shape.
 *
 * The explorer URL is the Testnet one specified by the Phase 10 prompt;
 * generalizing it to the configured network is deferred until explorer-network
 * mapping lands.
 */

import { useEffect, type ReactNode } from "react";
import { MILESTONE_TONE } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import { formatStroopsAsUnits, shortenAddress } from "@/utils/format";

interface MilestoneDetailsModalProps {
  milestone: Milestone;
  onClose: () => void;
  /** Payment transaction hash — from event reads (Phase 12). */
  txHash?: string | null;
}

/** Where the milestone is in the escrow→release flow, from its status. */
function paymentStateText(status: MilestoneStatus): string {
  switch (status) {
    case "paid":
      return "Released to freelancer";
    case "approved":
      return "Approved — awaiting release";
    case "submitted":
      return "Awaiting client approval";
    case "pending":
      return "Not yet submitted";
    case "disputed":
      return "Paused — under dispute";
    case "cancelled":
      return "Cancelled — not paid";
  }
}

/** What we can honestly say about the approval record from status alone. */
function approvalRecordText(status: MilestoneStatus): string {
  switch (status) {
    case "paid":
    case "approved":
      return "Approved by the client — approver + timestamp land with event reads (Phase 12).";
    case "submitted":
      return "Awaiting client approval.";
    case "pending":
      return "Not submitted yet — no approval record.";
    case "disputed":
      return "Approval contested — a dispute was opened.";
    case "cancelled":
      return "No approval — cancelled.";
  }
}

function formatDue(dueDate: number): string {
  return new Date(dueDate * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-800 pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm text-ink-100">{children}</dd>
    </div>
  );
}

export function MilestoneDetailsModal({
  milestone,
  onClose,
  txHash = null,
}: MilestoneDetailsModalProps) {
  // Close on Escape — standard modal affordance.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: click closes the modal. */}
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-details-title"
        className="relative w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-glow"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="milestone-details-title"
              className="truncate text-base font-semibold text-ink-50"
            >
              {milestone.name}
            </h3>
            <p className="mt-0.5 text-xs text-ink-400">
              Milestone #{milestone.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close milestone details"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-ink-700 p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 md:min-h-0 md:min-w-0"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <dl className="mt-5 space-y-4">
          <DetailRow label="Status">
            <Badge tone={MILESTONE_TONE[milestone.status]}>
              {milestone.status}
            </Badge>
          </DetailRow>
          <DetailRow label="Amount">
            <span className="tabular-nums">
              {formatStroopsAsUnits(milestone.amount)} XLM
            </span>
          </DetailRow>
          <DetailRow label="Due date">{formatDue(milestone.dueDate)}</DetailRow>
          <DetailRow label="Submission note">
            <span className="text-ink-400">
              — Submission notes land with event reads (Phase 12).
            </span>
          </DetailRow>
          <DetailRow label="Approval record">
            {approvalRecordText(milestone.status)}
          </DetailRow>
          <DetailRow label="Payment state">
            {paymentStateText(milestone.status)}
          </DetailRow>
          <DetailRow label="Transaction">
            {txHash ? (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                title={txHash}
                className="font-mono text-xs text-navy-300 underline decoration-navy-500/40 underline-offset-2 transition-colors hover:text-navy-200"
              >
                {shortenAddress(txHash)}
              </a>
            ) : (
              <span className="text-ink-400">
                — Tx records land with event reads (Phase 12).
              </span>
            )}
          </DetailRow>
        </dl>
      </div>
    </div>
  );
}
