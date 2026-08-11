/**
 * Dispute resolution timeline (Phase 13).
 *
 * Case-timeline style, mirroring the milestone timeline's vertical flow:
 *
 *   opened → (arbitrator review) → resolved
 *
 * Each step renders real on-chain facts from the `DisputeRecord` (built from
 * escrow `DISPUTE_OPENED` / `DISPUTE_RESOLVED` events):
 *   - opened   — initiator + reason + when it was opened
 *   - review   — amber "under review" while open, replaced by the outcome once
 *                `resolve_dispute` lands on-chain
 *   - outcome  — ReleasedToFreelancer (emerald) / RefundedToClient (amber),
 *                with the resolution time
 *
 * The milestone amount (when a real `get_milestone` read resolved) is shown
 * as the amount affected; "—" means the read hasn't landed yet.
 */

import type { ReactNode, SVGProps } from "react";
import { Badge } from "@/components/ui/Badge";
import type { DisputeRecord } from "@/types/dispute";
import type { Milestone } from "@/types/milestone";
import {
  formatStroopsAsUnits,
  relativeTime,
  shortenAddress,
} from "@/utils/format";

interface ResolutionTimelineProps {
  dispute: DisputeRecord;
  /** The disputed milestone (real `get_milestone` read) — amount affected. */
  milestone?: Milestone | null;
}

const DISPUTE_BADGE_TONE = {
  open: "red",
  resolved: "gray",
} as const;

const OUTCOME_TONE = {
  ReleasedToFreelancer: "green",
  RefundedToClient: "amber",
} as const;

const OUTCOME_DOT_CLASSES = {
  ReleasedToFreelancer: "border-emerald-500/50 text-emerald-300",
  RefundedToClient: "border-amber-500/50 text-amber-300",
} as const;

const OUTCOME_LABEL = {
  ReleasedToFreelancer: "Released to freelancer",
  RefundedToClient: "Refunded to client",
} as const;

export function ResolutionTimeline({
  dispute,
  milestone,
}: ResolutionTimelineProps) {
  return (
    <ol className="relative mt-5">
      {/* Connector track behind the dots. */}
      <div
        aria-hidden="true"
        className="absolute bottom-8 left-[11px] top-4 w-0.5 -translate-x-1/2 bg-ink-800"
      />

      <Step
        icon={<FlagIcon />}
        dotClassName="border-red-500/50 text-red-300"
        title="Dispute opened"
      >
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          Opened by{" "}
          <span className="font-mono text-ink-200" title={dispute.initiator}>
            {dispute.initiator ? shortenAddress(dispute.initiator) : "unknown address"}
          </span>{" "}
          · {relativeTime(dispute.openedAt)}
        </p>
        {dispute.reason ? (
          <blockquote className="mt-2 rounded-lg border-l-2 border-red-500/40 bg-red-500/5 px-3 py-2 text-xs italic leading-relaxed text-ink-200">
            “{dispute.reason}”
          </blockquote>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            Reason unavailable — this dispute opened outside the recent history
            window.
          </p>
        )}
        {milestone && (
          <p className="mt-2 text-xs tabular-nums text-ink-400">
            Amount affected:{" "}
            <span className="font-semibold text-ink-100">
              {formatStroopsAsUnits(milestone.amount)} XLM
            </span>{" "}
            · Milestone {dispute.milestoneId}
          </p>
        )}
      </Step>

      {dispute.resolved ? (
        <Step
          icon={<GavelIcon />}
          dotClassName="border-emerald-500/50 text-emerald-300"
          title="Dispute resolved"
        >
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {relativeTime(dispute.resolvedAt ?? 0)}
          </p>
        </Step>
      ) : (
        <Step
          icon={<HourglassIcon />}
          dotClassName="border-amber-500/50 text-amber-300"
          title="Under arbitrator review"
          pulsing
        >
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Awaiting a resolution decision from the escrow's arbitrator.
          </p>
        </Step>
      )}

      <Step
        icon={<ShieldIcon />}
        dotClassName={
          dispute.resolved
            ? OUTCOME_DOT_CLASSES[dispute.outcome ?? "RefundedToClient"]
            : "border-ink-600 text-ink-400"
        }
        title={
          dispute.resolved
            ? OUTCOME_LABEL[dispute.outcome ?? "RefundedToClient"]
            : "Outcome pending"
        }
      >
        {dispute.resolved ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              tone={OUTCOME_TONE[dispute.outcome ?? "RefundedToClient"]}
            >
              {OUTCOME_LABEL[dispute.outcome ?? "RefundedToClient"]}
            </Badge>
            <span className="text-xs text-ink-400">
              {relativeTime(dispute.resolvedAt ?? 0)}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Escrowed funds stay held until the arbitrator decides.
          </p>
        )}
      </Step>
    </ol>
  );
}

/** Status badge used in the card header (open = red, resolved = gray). */
export function disputeBadgeTone(dispute: DisputeRecord) {
  return DISPUTE_BADGE_TONE[dispute.resolved ? "resolved" : "open"];
}

function Step({
  icon,
  dotClassName,
  title,
  children,
  pulsing = false,
}: {
  icon: ReactNode;
  dotClassName: string;
  title: string;
  children: ReactNode;
  pulsing?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <span
        aria-hidden="true"
        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-ink-900 ${dotClassName} ${
          pulsing ? "animate-pulse" : ""
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="text-sm font-semibold text-ink-50">{title}</p>
        {children}
      </div>
    </li>
  );
}

function FlagIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
      <path d="M4 22v-7" />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m14 13-8 8" />
      <path d="m14 3 7 7-3.5 3.5-7-7L14 3Z" />
      <path d="m4 14 4.5 4.5" />
      <path d="M2 21h6" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L11 11 7.6 6.6A2 2 0 0 1 7 5.2V2" />
      <path d="M7 22v-4.2a2 2 0 0 1 .6-1.4L11 11l3.4 4.4a2 2 0 0 1 .6 1.4V22" />
    </svg>
  );
}

function ShieldIcon() {
  const shared: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  return (
    <svg {...shared} className="h-3 w-3">
      <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z" />
      <path d="M12 8v4" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  );
}
