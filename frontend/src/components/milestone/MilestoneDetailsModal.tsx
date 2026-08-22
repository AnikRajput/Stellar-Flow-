/**
 * Milestone details modal — redesigned with premium colors.
 *
 * Read-only record for one milestone: status, amount, due date, etc.
 */

import { useEffect, type ReactNode } from "react";
import { MILESTONE_TONE } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import { formatStroopsAsUnits, shortenAddress } from "@/utils/format";

interface MilestoneDetailsModalProps {
  milestone: Milestone;
  onClose: () => void;
  txHash?: string | null;
}

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

function approvalRecordText(status: MilestoneStatus): string {
  switch (status) {
    case "paid":
    case "approved":
      return "Approved by the client.";
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
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[13px] text-text-secondary">
        {children}
      </dd>
    </div>
  );
}

export function MilestoneDetailsModal({
  milestone,
  onClose,
  txHash = null,
}: MilestoneDetailsModalProps) {
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
      <div
        className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-details-title"
        className="relative w-full max-w-md rounded-xl border border-border-subtle bg-surface-2 p-6 shadow-card animate-scale-in"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="milestone-details-title"
              className="truncate text-base font-semibold text-text-primary"
            >
              {milestone.name}
            </h3>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              Milestone #{milestone.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close milestone details"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default p-1.5 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <dl className="mt-5 space-y-3.5">
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
            <span className="text-text-muted">—</span>
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
                className="font-mono text-[11px] text-accent-400 underline decoration-accent-500/30 underline-offset-2 transition-colors hover:text-accent-300"
              >
                {shortenAddress(txHash)}
              </a>
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </DetailRow>
        </dl>
      </div>
    </div>
  );
}
