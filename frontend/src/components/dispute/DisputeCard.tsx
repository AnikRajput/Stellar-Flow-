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
    <article className="rounded-xl border border-border-subtle bg-surface-2/60 p-4 transition-all duration-200 hover:border-border-default hover:bg-surface-3/40">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-text-primary">
            Project #{dispute.projectId} ·{" "}
            {dispute.milestoneId > 0 ? `Milestone ${dispute.milestoneId}` : "Milestone —"}
          </h3>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
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
          <dt className="text-[10px] uppercase tracking-wider text-text-muted">
            Opened by
          </dt>
          <dd
            className="mt-0.5 truncate font-mono text-[11px] text-text-secondary"
            title={dispute.initiator || undefined}
          >
            {dispute.initiator
              ? shortenAddress(dispute.initiator)
              : "Unknown"}
            {role && (
              <span className="ml-1.5 font-sans text-[11px] text-accent-400">
                ({role.toLowerCase()})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-text-muted">
            Amount affected
          </dt>
          <dd className="mt-0.5 text-[13px] tabular-nums text-text-secondary">
            {milestone
              ? `${formatStroopsAsUnits(milestone.amount)} XLM`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-text-muted">
            Status
          </dt>
          <dd className="mt-0.5 text-[13px] text-text-secondary">
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
