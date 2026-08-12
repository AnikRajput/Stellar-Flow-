/**
 * Milestone timeline (Phase 10 → Phase 11 wiring).
 *
 * Renders a project's milestones as a vertical flow:
 *
 *  - a connector line whose FILLED portion is `(paid value / total value)` —
 *    real on-chain stroop amounts, not a count-based approximation
 *  - one node per milestone in a flow state from the set `paid | submitted |
 *    locked | disputed`; `locked` is a UI category covering Pending + Approved
 *    (funds held in escrow, awaiting submission or release). A gray `cancelled`
 *    node is included as an edge case because Cancelled is a real contract
 *    state.
 *  - role-aware actions derived from `useWallet().address` compared to
 *    `project.client` / `project.freelancer` — never hardcoded:
 *      freelancer → "Submit" on `pending` milestones
 *      client     → "Approve" / "Dispute" on `submitted` milestones
 *      anyone else → read-only
 *
 * Action buttons now run the REAL transaction lifecycle (`useTransaction`):
 * build → simulate → sign (Freighter) → submit → poll, calling the escrow
 * contract's `submit_milestone` / `approve_milestone` / `open_dispute`. Each
 * row shows a TxStatusPanel while its action is in flight and after it settles
 * (confirmed → explorer link; failed → plain-language reason + Try Again). The
 * local milestone status is never mutated optimistically — the timeline
 * reflects on-chain state once reads land (Phase 12).
 */

import { useState, type SVGProps } from "react";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { OpenDisputeModal } from "@/components/dispute/OpenDisputeModal";
import { MILESTONE_TONE } from "@/components/project/ProjectCard";
import { TxStatusPanel } from "@/components/transaction/TxStatusPanel";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTransaction } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { getEscrowContract } from "@/services/contracts";
import { buildTx, toScVal } from "@/services/transactions";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import type { Project } from "@/types/project";
import { formatStroopsAsUnits, parseStroops } from "@/utils/format";

type ViewerRole = "client" | "freelancer" | "neither";

/**
 * Flow state a node renders as. `locked` is a UI category covering Pending +
 * Approved (funds held in escrow, awaiting submission or release).
 */
type NodeState = "paid" | "submitted" | "locked" | "disputed" | "cancelled";

interface MilestoneTimelineProps {
  project: Project;
  milestones: Milestone[];
  loading?: boolean;
  error?: Error | null;
  /** Opens the details modal for a milestone (ProjectDetails owns the modal). */
  onOpenDetails?: (milestone: Milestone) => void;
}

interface MilestoneAction {
  label: string;
  /** Contract method for direct actions (absent for modal-driven actions). */
  method?: "submit_milestone" | "approve_milestone";
  /** When true, opens the OpenDisputeModal instead of calling a method. */
  opensModal?: boolean;
  /** Builds the contract args (ScVals) for a connected wallet address. */
  args?: (address: string) => xdr.ScVal[];
  className: string;
}

/** Settled outcome of one row's action (kept per milestone id). */
interface RowResult {
  outcome: "confirmed" | "failed";
  hash: string | null;
  error: string | null;
  /** The action that produced this result — reused by Try Again. */
  action: MilestoneAction;
}

// Phase 15: `min-h-11 md:min-h-0` keeps the ≥44px mobile/tablet tap target
// while restoring the compact desktop height; `flex-1 md:flex-none` stretches
// the actions full-width on phones (two actions split the row evenly).
const MOBILE_TARGET =
  "min-h-11 md:min-h-0 flex-1 md:flex-none";
const SUBMIT_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow transition-colors hover:bg-navy-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${MOBILE_TARGET}`;
const APPROVE_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${MOBILE_TARGET}`;
const DISPUTE_BUTTON_CLASS =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 ${MOBILE_TARGET}`;

/** Node state derived from the on-chain milestone status. */
function nodeState(status: MilestoneStatus): NodeState {
  if (status === "paid") return "paid";
  if (status === "submitted") return "submitted";
  if (status === "disputed") return "disputed";
  if (status === "cancelled") return "cancelled";
  // Pending and Approved both sit in escrow awaiting the next action.
  return "locked";
}

/** Per-state dot tint (solid `bg-ink-900` masks the connector line behind). */
const NODE_DOT_CLASSES: Record<NodeState, string> = {
  paid: "border-emerald-500/50 text-emerald-300",
  submitted: "border-amber-500/50 text-amber-300",
  locked: "border-navy-500/50 text-navy-300",
  disputed: "border-red-500/50 text-red-300",
  cancelled: "border-ink-600 text-ink-400",
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

/** Role-aware action buttons for one milestone row. */
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
        // Opens the OpenDisputeModal (real reason input → open_dispute) instead
        // of sending a placeholder reason directly.
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
  // All hooks run before any conditional return — React rules of hooks.
  const { address } = useWallet();
  const tx = useTransaction();
  /** Id of the milestone whose action is currently in flight (one at a time). */
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, RowResult>>({});
  /** Milestone the client flagged for dispute — drives the OpenDisputeModal. */
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

  // Filled portion of the connector = paid value / total value (exact stroops).
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
        // Non-modal actions always carry method + args (see runAction guard).
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
      <div
        role="alert"
        className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center"
      >
        <p className="text-sm font-medium text-red-200">
          Couldn't load this project's milestones.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
          {error.message}
        </p>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
        <p className="text-sm font-medium text-ink-200">No milestones yet</p>
        <p className="mt-1 text-xs text-ink-400">
          Milestones added to this project appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-100">Milestone flow</h3>
        <p className="text-xs text-ink-400">Viewing as {roleLabel(role)}</p>
      </div>
      <p className="mt-1 text-xs tabular-nums text-ink-400">
        {formatStroopsAsUnits(paidStroops.toString())} of{" "}
        {formatStroopsAsUnits(totalStroops.toString())} XLM paid ({filledPercent}
        %)
      </p>

      <ol className="relative mt-6">
        {/* Connector: track + filled portion proportional to paid/total value.
            Offset tracks the node diameter — 20px on mobile, 24px at sm+. */}
        <div
          aria-hidden="true"
          className="absolute bottom-5 left-[9px] top-5 w-0.5 -translate-x-1/2 rounded-full bg-ink-800 sm:bottom-6 sm:left-[11px] sm:top-6"
        >
          <div
            className="absolute inset-x-0 top-0 rounded-full bg-emerald-500/80 transition-all duration-500"
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
              className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4 sm:pb-8"
            >
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-ink-900 sm:h-6 sm:w-6 ${NODE_DOT_CLASSES[state]}`}
              >
                <NodeIcon state={state} />
              </span>

              <div className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-900/60 p-3 transition-colors hover:border-ink-700 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetails?.(milestone)}
                    className="text-sm font-semibold text-ink-50 transition-colors hover:text-navy-200"
                  >
                    {milestone.name}
                  </button>
                  <Badge tone={MILESTONE_TONE[milestone.status]}>
                    {milestone.status}
                  </Badge>
                </div>

                <p className="mt-1 text-xs tabular-nums text-ink-400">
                  {formatStroopsAsUnits(milestone.amount)} XLM · Due{" "}
                  {formatDue(milestone.dueDate)}
                </p>

                {rowActions.length > 0 && !alreadyConfirmed && (
                  <div className="mt-3 flex flex-wrap gap-2">
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

                {/* Live panel while this row's action is in flight. */}
                {isActive && (
                  <div className="mt-3">
                    <TxStatusPanel
                      state={tx.state}
                      hash={tx.hash}
                      error={tx.error}
                      label={activeLabel ?? undefined}
                    />
                  </div>
                )}

                {/* Settled panel once the action finishes. */}
                {!isActive && rowResult && (
                  <div className="mt-3">
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

/** Mirrors the timeline rows so loading doesn't shift the layout. */
function TimelineSkeleton() {
  return (
    <div className="relative mt-6">
      <div
        aria-hidden="true"
        className="absolute bottom-5 left-[9px] top-5 w-0.5 -translate-x-1/2 bg-ink-800 sm:bottom-6 sm:left-[11px] sm:top-6"
      />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4 sm:pb-8"
        >
          <span className="relative z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border border-ink-800 bg-ink-900 sm:h-6 sm:w-6" />
          <div className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-900/60 p-3 sm:p-4">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
