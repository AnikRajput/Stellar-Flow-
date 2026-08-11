/**
 * Activity feed row (Phase 12).
 *
 * One line of the live activity feed: a per-event-type icon, a one-line human
 * description (shared `eventMeta`), the relative time, and a link to the
 * transaction on Stellar Expert. `compact` is the Dashboard variant — smaller
 * and without the topic chip.
 */

import type { SVGProps } from "react";
import type { ContractEvent, ContractEventName } from "@/types/event";
import { explorerTxUrl, relativeTime, shortenAddress } from "@/utils/format";
import { eventMeta } from "@/utils/eventMeta";
import { formatStroopsAsUnits } from "@/utils/format";

interface ActivityFeedRowProps {
  event: ContractEvent;
  /** Compact variant for the Dashboard panel. */
  compact?: boolean;
}

/** Icon tint per event type — semantic (green/amber/red) for money flows. */
const TOPIC_TINT: Record<ContractEventName, string> = {
  FUNDS_DEPOSITED: "bg-navy-500/15 text-navy-300",
  MILESTONE_CREATED: "bg-ink-700 text-ink-300",
  MILESTONE_SUBMITTED: "bg-amber-500/15 text-amber-300",
  MILESTONE_APPROVED: "bg-emerald-500/15 text-emerald-300",
  PAYMENT_RELEASED: "bg-emerald-500/15 text-emerald-300",
  DISPUTE_OPENED: "bg-red-500/15 text-red-300",
  DISPUTE_RESOLVED: "bg-amber-500/15 text-amber-300",
  PROJECT_CANCELLED: "bg-ink-700 text-ink-400",
  REFUND_ISSUED: "bg-navy-500/15 text-navy-300",
  PROJECT_COMPLETED: "bg-emerald-500/15 text-emerald-300",
  FUNDS_HELD: "bg-navy-500/15 text-navy-300",
  FUNDS_RELEASED: "bg-emerald-500/15 text-emerald-300",
  FUNDS_REFUNDED: "bg-navy-500/15 text-navy-300",
  PROJECT_CREATED: "bg-emerald-500/15 text-emerald-300",
  PROJECT_PAUSED: "bg-amber-500/15 text-amber-300",
};

export function ActivityFeedRow({ event, compact = false }: ActivityFeedRowProps) {
  const meta = eventMeta(event);

  return (
    <article
      className={`flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-900/50 transition-colors hover:border-ink-700 ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-lg ${TOPIC_TINT[event.topic]} ${
          compact ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        <TopicIcon topic={event.topic} className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-ink-100 ${compact ? "text-xs" : "text-sm"}`}>
          {meta.summary}
          {meta.amountStroops && (
            <span className="font-medium tabular-nums text-ink-50">
              {" · "}
              {formatStroopsAsUnits(meta.amountStroops)} XLM
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-400">
          {!compact && (
            <span className="font-medium uppercase tracking-wide text-ink-500">
              {event.topic}
            </span>
          )}
          <span>{relativeTime(event.timestamp)}</span>
          <a
            href={explorerTxUrl(event.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            title={event.txHash}
            className="font-mono text-navy-300 underline decoration-navy-500/40 underline-offset-2 transition-colors hover:text-navy-200"
          >
            {shortenAddress(event.txHash)}
          </a>
        </p>
      </div>
    </article>
  );
}

function TopicIcon({ topic, className }: { topic: ContractEventName; className?: string }) {
  const shared: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (topic) {
    case "FUNDS_DEPOSITED":
      return (
        <svg {...shared} className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 9h3" />
          <path d="M18 9h3" />
          <path d="M12 12v3" />
          <path d="m10 14 2 2 2-2" />
        </svg>
      );
    case "MILESTONE_CREATED":
      return (
        <svg {...shared} className={className}>
          <path d="M5 3v18" />
          <path d="M5 5h11l-2 3 2 3H5" />
        </svg>
      );
    case "MILESTONE_SUBMITTED":
      return (
        <svg {...shared} className={className}>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      );
    case "MILESTONE_APPROVED":
      return (
        <svg {...shared} className={className}>
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      );
    case "PAYMENT_RELEASED":
      return (
        <svg {...shared} className={className}>
          <path d="M12 19V5" />
          <path d="m5 12 7 7 7-7" />
        </svg>
      );
    case "DISPUTE_OPENED":
      return (
        <svg {...shared} className={className}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "DISPUTE_RESOLVED":
      return (
        <svg {...shared} className={className}>
          <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z" />
          <path d="m8.5 11 2.5 2.5 4.5-5" />
        </svg>
      );
    case "PROJECT_CANCELLED":
      return (
        <svg {...shared} className={className}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case "REFUND_ISSUED":
    case "FUNDS_REFUNDED":
      return (
        <svg {...shared} className={className}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
    case "PROJECT_COMPLETED":
      return (
        <svg {...shared} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      );
    case "FUNDS_HELD":
      return (
        <svg {...shared} className={className}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "FUNDS_RELEASED":
      return (
        <svg {...shared} className={className}>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      );
    case "PROJECT_CREATED":
      return (
        <svg {...shared} className={className}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "PROJECT_PAUSED":
      return (
        <svg {...shared} className={className}>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      );
  }
}
