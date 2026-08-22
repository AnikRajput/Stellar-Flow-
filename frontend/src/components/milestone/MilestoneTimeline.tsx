/**
 * Milestone timeline — redesigned with premium colors.
 *
 * Vertical flow with connector line, role-aware actions, and TxStatusPanel.
 */

import { useState, type SVGProps } from "react";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { OpenDisputeModal } from "@/components/dispute/OpenDisputeModal";
import { MILESTONE_TONE } from "@/components/project/ProjectCard";
import { TxStatusPanel } from "@/components/transaction/TxStatusPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTransaction } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { getEscrowContract } from "@/services/contracts";
import { buildTx, toScVal } from "@/services/transactions";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import type { Project } from "@/types/project";
import { formatStroopsAsUnits, parseStroops } from "@/utils/format";

type ViewerRole = "client" | "freelancer" | "neither";
type NodeState = "paid" | "submitted" | "locked" | "disputed" | "cancelled";

interface MilestoneTimelineProps {
  project: Project;
  milestones: Milestone[];
  loading?: boolean;
  error?: Error | null;
  onOpenDetails?: (milestone: Milestone) => void;
}

interface MilestoneAction {
  label: string;
  method?: "submit_milestone" | "approve_milestone";
  opensModal?: boolean;
  args?: (address: string) => xdr.ScVal[];
  className: string;
}

interface RowResult {
  outcome: "confirmed" | "failed";
  hash: string | null;
  error: string | null;
  action: MilestoneAction;
}

const MOBILE_TARGET = "min-h-11 md:min-h-0 flex-1 md:flex-none";

const SUBMIT_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-gradient px-3 py-1.5 text-xs font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${MOBILE_TARGET}`;

const APPROVE_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-success-500/20 bg-success-500/10 px-3 py-1.5 text-xs font-medium text-success-300 transition-colors hover:bg-success-500/15 disabled:cursor-not-allowed disabled:opacity-40 ${MOBILE_TARGET}`;

const DISPUTE_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-error-500/20 bg-error-500/5 px-3 py-1.5 text-xs font-medium text-error-300 transition-colors hover:bg-error-500/10 disabled:cursor-not-allowed disabled:opacity-40 ${MOBILE_TARGET}`;

function nodeState(status: MilestoneStatus): NodeState {
  if (status === "paid") return "paid";
  if (status === "submitted") return "submitted";
  if (status === "disputed") return "disputed";
  if (status === "cancelled") return "cancelled";
  return "locked";
}

const NODE_DOT_CLASSES: Record<NodeState, string> = {
  paid: "border-success-500/50 text-success-400",
  submitted: "border-warning-500/50 text-warning-400",
  locked: "border-accent-500/50 text-accent-400",
  disputed: "border-error-500/50 text-error-400",
  cancelled: "border-border-default text-text-tertiary",
};

function NodeIcon({ state }: { state: NodeState }) {
  const shared: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (state) {
    case "paid":
      return (
        <svg {...shared} className="h-3 w-3">
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      );
    case "submitted":
      return (
        <svg {...shared} className="h-3 w-3">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "locked":
      return (
        <svg {...shared} className="h-3 w-3">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "disputed":
      return (
        <svg {...shared} className="h-3 w-3">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "cancelled":
      return (
        <svg {...shared} className="h-3 w-3">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
  }
}

function roleLabel(role: ViewerRole): string {
  if (role === "client") return "client";
  if (role === "freelancer") return "freelancer";
  return "guest — read-only";
}

function formatDue(dueDate: number): string {
  return new Date(dueDate * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function roleActions(
  role: ViewerRole,
  milestone: Milestone,
  projectId: number,
): MilestoneAction[] {
  if (role === "freelancer" && milestone.status === "pending") {
    return [
      {
        label: "Submit",
        method: "submit_milestone",
        args: (address) => [
          toScVal(address),
          nativeToScVal(projectId, { type: "u32" }),
          nativeToScVal(milestone.id, { type: "u32" }),
        ],
        className: SUBMIT_BUTTON_CLASS,
      },
    ];
  }
  if (role === "client" && milestone.status === "submitted") {
    return [
      {
        label: "Approve",
        method: "approve_milestone",
        args: (address) => [
          toScVal(address),
          nativeToScVal(projectId, { type: "u32" }),
          nativeToScVal(milestone.id, { type: "u32" }),
        ],
        className: APPROVE_BUTTON_CLASS,
      },
      {
        label: "Dispute",
        opensModal: true,
        className: DISPUTE_BUTTON_CLASS,
      },
    ];
  }
  return [];
}

export function MilestoneTimeline({
  project,
  milestones,
  loading = false,
  error = null,
  onOpenDetails,
}: MilestoneTimelineProps) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, RowResult>>({});
  const [disputeMilestone, setDisputeMilestone] = useState<Milestone | null>(
    null,
  );

  const role: ViewerRole =
    address === project.client
      ? "client"
      : address === project.freelancer
        ? "freelancer"
        : "neither";

  const busy = activeId !== null;

  const paidStroops = milestones.reduce(
    (sum, milestone) =>
      milestone.status === "paid" ? sum + parseStroops(milestone.amount) : sum,
    0n,
  );
  const totalStroops = parseStroops(project.totalAmount);
  const filledPercent =
    totalStroops > 0n
      ? Math.min(100, Number((paidStroops * 100n) / totalStroops))
      : 0;

  async function runAction(
    milestone: Milestone,
    action: MilestoneAction,
  ): Promise<void> {
    if (!address || busy) return;
    if (action.opensModal) {
      setDisputeMilestone(milestone);
      return;
    }
    setActiveId(milestone.id);
    setActiveLabel(action.label);
    const result = await tx.execute(() =>
      buildTx({
        contract: getEscrowContract(),
        method: action.method!,
        args: action.args!(address),
        source: address,
      }),
    );
    setResults((prev) => ({
      ...prev,
      [milestone.id]: {
        outcome: result.outcome,
        hash: result.hash,
        error: result.error,
        action,
      },
    }));
    setActiveId(null);
    setActiveLabel(null);
  }

  if (loading) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load milestones"
        message={error.message}
      />
    );
  }

  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3v18" />
            <path d="M5 5h11l-2 3 2 3H5" />
          </svg>
        }
        title="No milestones yet"
        description="Milestones added to this project appear here."
      />
    );
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-text-primary">
            Milestone flow
          </h3>
          <p className="text-[11px] text-text-tertiary">
            Viewing as {roleLabel(role)}
          </p>
        </div>
        <p className="mt-1 text-[11px] tabular-nums text-text-tertiary">
          {formatStroopsAsUnits(paidStroops.toString())} of{" "}
          {formatStroopsAsUnits(totalStroops.toString())} XLM paid (
          {filledPercent}%)
        </p>

        <ol className="relative mt-5">
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-[9px] top-5 w-0.5 -translate-x-1/2 rounded-full bg-surface-4 sm:bottom-6 sm:left-[11px] sm:top-6"
          >
            <div
              className="absolute inset-x-0 top-0 rounded-full bg-success-500/80 transition-all duration-500"
              style={{ height: `${filledPercent}%` }}
            />
          </div>

          {milestones.map((milestone) => {
            const state = nodeState(milestone.status);
            const rowActions = roleActions(role, milestone, project.id);
            const rowResult = results[milestone.id];
            const isActive = activeId === milestone.id;
            const alreadyConfirmed = rowResult?.outcome === "confirmed";

            return (
              <li
                key={milestone.id}
                className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4 sm:pb-6"
              >
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-surface-1 sm:h-6 sm:w-6 ${NODE_DOT_CLASSES[state]}`}
                >
                  <NodeIcon state={state} />
                </span>

                <div className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface-2/60 p-3 transition-colors hover:border-border-default sm:p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails?.(milestone)}
                      className="text-[13px] font-semibold text-text-primary transition-colors hover:text-accent-300"
                    >
                      {milestone.name}
                    </button>
                    <Badge tone={MILESTONE_TONE[milestone.status]}>
                      {milestone.status}
                    </Badge>
                  </div>

                  <p className="mt-1 text-[11px] tabular-nums text-text-tertiary">
                    {formatStroopsAsUnits(milestone.amount)} XLM · Due{" "}
                    {formatDue(milestone.dueDate)}
                  </p>

                  {rowActions.length > 0 && !alreadyConfirmed && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {rowActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction(milestone, action)}
                          className={action.className}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {isActive && (
                    <div className="mt-2.5">
                      <TxStatusPanel
                        state={tx.state}
                        hash={tx.hash}
                        error={tx.error}
                        label={activeLabel ?? undefined}
                      />
                    </div>
                  )}

                  {!isActive && rowResult && (
                    <div className="mt-2.5">
                      <TxStatusPanel
                        state={rowResult.outcome === "confirmed" ? "confirmed" : "failed"}
                        hash={rowResult.hash}
                        error={rowResult.error}
                        label={rowResult.action.label}
                        onRetry={
                          rowResult.outcome === "failed"
                            ? () => void runAction(milestone, rowResult.action)
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {disputeMilestone && (
        <OpenDisputeModal
          project={project}
          milestone={disputeMilestone}
          onClose={() => setDisputeMilestone(null)}
          onOpened={() => setDisputeMilestone(null)}
        />
      )}
    </>
  );
}

function TimelineSkeleton() {
  return (
    <div className="relative mt-5">
      <div
        aria-hidden="true"
        className="absolute bottom-5 left-[9px] top-5 w-0.5 -translate-x-1/2 bg-surface-4 sm:bottom-6 sm:left-[11px] sm:top-6"
      />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4 sm:pb-6"
        >
          <span className="relative z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border border-border-default bg-surface-1 sm:h-6 sm:w-6" />
          <div className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface-2/60 p-3 sm:p-3.5">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="mt-2 h-2.5 w-28 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
