/**
 * Shared presentation metadata for contract events (Phase 12, supporting).
 *
 * One function (`eventMeta`) derives the human description and the table
 * columns (project, amount, wallet, status) for every event type, so the
 * Dashboard feed row and the Activity table describe events identically
 * instead of duplicating per-type logic.
 */

import type { ContractEvent } from "@/types/event";
import { formatStroopsAsUnits, shortenAddress } from "@/utils/format";

export interface EventMeta {
  /** Human one-liner, e.g. "Milestone 2 submitted on Project #7". */
  summary: string;
  /** Project the event concerns (null when not applicable). */
  projectId: number | null;
  /** Amount in stroops as a string, when the event carries one. */
  amountStroops: string | null;
  /** The wallet address most relevant to the event (null when none). */
  wallet: string | null;
  /** Short status label for tables (e.g. "Paid", "Pending review"). */
  statusLabel: string;
}

const XLM = (stroops: string): string =>
  `${formatStroopsAsUnits(stroops)} XLM`;

/** Derives presentation fields for any decoded event (all 15 topics). */
export function eventMeta(event: ContractEvent): EventMeta {
  switch (event.topic) {
    case "FUNDS_DEPOSITED": {
      const { projectId, client, amount } = event.data;
      return {
        summary: `Project #${projectId} funded by ${shortenAddress(client)}`,
        projectId,
        amountStroops: amount,
        wallet: client,
        statusLabel: "Funded",
      };
    }
    case "MILESTONE_CREATED": {
      const { projectId, milestoneId, amount } = event.data;
      return {
        summary: `Milestone ${milestoneId} added to Project #${projectId}`,
        projectId,
        amountStroops: amount,
        wallet: null,
        statusLabel: "Created",
      };
    }
    case "MILESTONE_SUBMITTED": {
      const { projectId, milestoneId, freelancer } = event.data;
      return {
        summary: `Milestone ${milestoneId} submitted on Project #${projectId} by ${shortenAddress(freelancer)}`,
        projectId,
        amountStroops: null,
        wallet: freelancer,
        statusLabel: "Pending review",
      };
    }
    case "MILESTONE_APPROVED": {
      const { projectId, milestoneId, client } = event.data;
      return {
        summary: `Milestone ${milestoneId} approved on Project #${projectId} by ${shortenAddress(client)}`,
        projectId,
        amountStroops: null,
        wallet: client,
        statusLabel: "Approved",
      };
    }
    case "PAYMENT_RELEASED": {
      const { projectId, milestoneId, freelancer, amount } = event.data;
      return {
        summary: `Milestone ${milestoneId} paid on Project #${projectId} → ${shortenAddress(freelancer)}`,
        projectId,
        amountStroops: amount,
        wallet: freelancer,
        statusLabel: "Paid",
      };
    }
    case "DISPUTE_OPENED": {
      const { projectId, milestoneId, initiator } = event.data;
      return {
        summary: `Dispute opened on Project #${projectId} (Milestone ${milestoneId}) by ${shortenAddress(initiator)}`,
        projectId,
        amountStroops: null,
        wallet: initiator,
        statusLabel: "Disputed",
      };
    }
    case "DISPUTE_RESOLVED": {
      const { projectId, disputeId, outcome } = event.data;
      const released = outcome === "ReleasedToFreelancer";
      return {
        summary: `Dispute #${disputeId} resolved on Project #${projectId} — ${released ? "released to freelancer" : "refunded to client"}`,
        projectId,
        amountStroops: null,
        wallet: null,
        statusLabel: released ? "Resolved" : "Refunded",
      };
    }
    case "PROJECT_CANCELLED": {
      const { projectId, caller } = event.data;
      return {
        summary: `Project #${projectId} cancelled by ${shortenAddress(caller)}`,
        projectId,
        amountStroops: null,
        wallet: caller,
        statusLabel: "Cancelled",
      };
    }
    case "REFUND_ISSUED": {
      const { projectId, client, amount } = event.data;
      return {
        summary: `Refund of ${XLM(amount)} issued to ${shortenAddress(client)} on Project #${projectId}`,
        projectId,
        amountStroops: amount,
        wallet: client,
        statusLabel: "Refunded",
      };
    }
    case "PROJECT_COMPLETED": {
      const { projectId } = event.data;
      return {
        summary: `Project #${projectId} completed`,
        projectId,
        amountStroops: null,
        wallet: null,
        statusLabel: "Completed",
      };
    }
    case "FUNDS_HELD": {
      const { projectId, milestoneId, from, amount } = event.data;
      return {
        summary: `Funds held for Milestone ${milestoneId} on Project #${projectId} from ${shortenAddress(from)}`,
        projectId,
        amountStroops: amount,
        wallet: from,
        statusLabel: "Held",
      };
    }
    case "FUNDS_RELEASED": {
      const { projectId, milestoneId, to, amount } = event.data;
      return {
        summary: `Funds released to ${shortenAddress(to)} for Milestone ${milestoneId} on Project #${projectId}`,
        projectId,
        amountStroops: amount,
        wallet: to,
        statusLabel: "Released",
      };
    }
    case "FUNDS_REFUNDED": {
      const { projectId, to, amount } = event.data;
      return {
        summary: `Funds refunded to ${shortenAddress(to)} on Project #${projectId}`,
        projectId,
        amountStroops: amount,
        wallet: to,
        statusLabel: "Refunded",
      };
    }
    case "PROJECT_CREATED": {
      const { projectId, client, freelancer, totalAmount } = event.data;
      return {
        summary: `Project #${projectId} created by ${shortenAddress(client)} for ${shortenAddress(freelancer)}`,
        projectId,
        amountStroops: totalAmount,
        wallet: client,
        statusLabel: "Created",
      };
    }
    case "PROJECT_PAUSED": {
      const { projectId, admin } = event.data;
      return {
        summary: `Project #${projectId} paused by ${shortenAddress(admin)}`,
        projectId,
        amountStroops: null,
        wallet: admin,
        statusLabel: "Paused",
      };
    }
  }
}
