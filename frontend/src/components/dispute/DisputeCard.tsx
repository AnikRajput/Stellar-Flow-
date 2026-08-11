/**
 * Dispute card (Phase 13).
 *
 * Summarizes one dispute reconstructed from escrow events: who opened it, the
 * reason, the amount affected (real `get_milestone` read), and the current
 * status — then embeds the ResolutionTimeline and the arbitrator-only
 * ResolveDisputeControls (which renders nothing for non-arbitrators).
 *
 * Data honesty: every field renders real on-chain facts. Project/milestone
 * enrichment is optional — when the read hasn't landed (or failed), the card
 * degrades to "—" instead of inventing values.
 */

import { Badge } from "@/components/ui/Badge";
import {
  disputeBadgeTone,
  ResolutionTimeline,
} from "@/components/dispute/ResolutionTimeline";
import { ResolveDisputeControls } from "@/components/dispute/ResolveDisputeControls";
import type { DisputeRecord } from "@/types/dispute";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";
import {
  formatStroopsAsUnits,
  relativeTime,
  shortenAddress,
} from "@/utils/format";

interface DisputeCardProps {
  dispute: DisputeRecord;
  /** Real `get_project` read for the disputed project (optional). */
  project?: Project | null;
  /** Real `get_milestone` read for the disputed milestone (optional). */
  milestone?: Milestone | null;
}

/** "Client" / "Freelancer" / undefined when the project read hasn't landed. */
function initiatorRole(
  dispute: DisputeRecord,
  project: Project | null | undefined,
): "Client" | "Freelancer" | undefined {
  if (!project) return undefined;
  if (dispute.initiator === project.client) return "Client";
  if (dispute.initiator === project.freelancer) return "Freelancer";
  return undefined;
}

export function DisputeCard({ dispute, project, milestone }: DisputeCardProps) {
  const role = initiatorRole(dispute, project);
  const statusLabel = dispute.resolved ? "Resolved" : "Open";

  return (
    <article className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 transition-colors hover:border-ink-700">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-50">
            Project #{dispute.projectId} ·{" "}
            {dispute.milestoneId > 0 ? `Milestone ${dispute.milestoneId}` : "Milestone —"}
          </h3>
          <p className="mt-0.5 text-xs text-ink-400">
            {dispute.disputeId !== null
              ? `Dispute #${dispute.disputeId}${dispute.disputeIdAuthoritative ? "" : " (approx.)"}`
              : "Dispute id unknown"}
            {" · "}
            {dispute.openedAt > 0 ? relativeTime(dispute.openedAt) : "opened outside recent history"}
          </p>
        </div>
        <Badge tone={disputeBadgeTone(dispute)}>{statusLabel}</Badge>
      </header>

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-500">
            Opened by
          </dt>
          <dd
            className="mt-0.5 truncate font-mono text-xs text-ink-100"
            title={dispute.initiator || undefined}
          >
            {dispute.initiator
              ? shortenAddress(dispute.initiator)
              : "Unknown"}
            {role && (
              <span className="ml-1.5 font-sans text-[11px] text-navy-300">
                ({role.toLowerCase()})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-500">
            Amount affected
          </dt>
          <dd className="mt-0.5 text-sm tabular-nums text-ink-100">
            {milestone
              ? `${formatStroopsAsUnits(milestone.amount)} XLM`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-500">
            Status
          </dt>
          <dd className="mt-0.5 text-sm text-ink-100">
            {dispute.resolved
              ? dispute.outcome === "ReleasedToFreelancer"
                ? "Released to freelancer"
                : "Refunded to client"
              : "Under review"}
          </dd>
        </div>
      </dl>

      <ResolutionTimeline dispute={dispute} milestone={milestone} />

      <ResolveDisputeControls dispute={dispute} />
    </article>
  );
}
