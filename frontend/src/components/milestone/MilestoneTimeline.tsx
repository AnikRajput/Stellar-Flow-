/**
 * Milestone timeline (Phase 10).
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
 * Action buttons run a REAL build+simulation of the corresponding escrow
 * method (`submit_milestone` / `approve_milestone` / `open_dispute`) through
 * `useContract` and surface the contract's verdict verbatim — no signing, no
 * fake state changes. Signing + submission land in Phase 11.
 */

import { useState, type SVGProps } from "react";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { CONTRACTS } from "@/config/contracts";
import { MILESTONE_TONE } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useContract } from "@/hooks/useContract";
import { useWallet } from "@/hooks/useWallet";
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

interface SimulationOutcome {
  ok: boolean;
  title: string;
  detail: string;
}

interface ActionFeedback {
  running: boolean;
  outcome: SimulationOutcome | null;
}

interface MilestoneAction {
  label: string;
  method: "submit_milestone" | "approve_milestone" | "open_dispute";
  /** Builds the contract args for a connected wallet address. */
  args: (address: string) => unknown[];
  className: string;
}

/**
 * Reason sent to `open_dispute` in simulation only — nothing persists on-chain
 * in this phase. A real reason input lands with the signing flow (Phase 11).
 */
const DISPUTE_REASON_PLACEHOLDER =
  "Dispute opened from the milestone timeline — reason input lands in Phase 11.";

const SUBMIT_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg bg-navy-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow transition-colors hover:bg-navy-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
const APPROVE_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40";
const DISPUTE_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40";

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

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Narrow the raw simulation response (returned as `unknown` by useContract)
 * into a human-readable outcome. Mirrors the documented rpc.Api response shape
 * used by the Phase 9 wizard: success carries `.result.retval`, failure `.error`.
 */
function describeSimulation(result: unknown, method: string): SimulationOutcome {
  if (result === null || typeof result !== "object") {
    return {
      ok: false,
      title: "Unexpected response",
      detail: "The RPC returned an unrecognized simulation result.",
    };
  }
  const sim = result as {
    error?: unknown;
    result?: { result?: "success" | "error"; retval?: unknown };
  };
  if (sim.error) {
    return {
      ok: false,
      title: "Contract rejected the call",
      detail: `Simulation error: ${String(sim.error)}`,
    };
  }
  if (sim.result) {
    // A reverted (panicked) call surfaces INSIDE `result` as `result ===
    // "error"`, not as a top-level `error` — treat it as a rejection, never
    // as success (mirrors the fix applied to CreateProject's copy).
    if (sim.result.result === "error") {
      return {
        ok: false,
        title: "Contract rejected the call",
        detail: `${method} reverted in simulation — the contract rejected it (e.g. InvalidState for this milestone's current status).`,
      };
    }
    // Some methods (submit/approve) return Void; open_dispute returns the new
    // dispute id (u32 → number). Decode when a retval is present.
    let returned = "";
    if (sim.result.retval) {
      try {
        const value = scValToNative(sim.result.retval as xdr.ScVal);
        if (value !== null && value !== undefined) {
          returned = ` (would return ${String(value)})`;
        }
      } catch {
        // Retval present but not decodable — the simulation itself succeeded.
      }
    }
    return {
      ok: true,
      title: "Validation succeeded",
      detail: `The escrow contract accepted ${method} in simulation${returned}. Signing and submission land in Phase 11.`,
    };
  }
  return {
    ok: false,
    title: "Inconclusive simulation",
    detail: "The RPC returned neither a result nor an error.",
  };
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
        args: (address) => [address, projectId, milestone.id],
        className: SUBMIT_BUTTON_CLASS,
      },
    ];
  }
  if (role === "client" && milestone.status === "submitted") {
    return [
      {
        label: "Approve",
        method: "approve_milestone",
        args: (address) => [address, projectId, milestone.id],
        className: APPROVE_BUTTON_CLASS,
      },
      {
        label: "Dispute",
        method: "open_dispute",
        args: (address) => [
          address,
          projectId,
          milestone.id,
          DISPUTE_REASON_PLACEHOLDER,
        ],
        className: DISPUTE_BUTTON_CLASS,
      },
    ];
  }
  return [];
}

function SpinnerIcon() {
  return (
    <svg
      className="h-3 w-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
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
  const { call } = useContract();
  const [actions, setActions] = useState<Record<number, ActionFeedback>>({});

  const role: ViewerRole =
    address === project.client
      ? "client"
      : address === project.freelancer
        ? "freelancer"
        : "neither";

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
    if (!address) return;
    setActions((prev) => ({
      ...prev,
      [milestone.id]: { running: true, outcome: null },
    }));
    try {
      const result = await call(CONTRACTS.escrow, action.method, action.args(address));
      setActions((prev) => ({
        ...prev,
        [milestone.id]: {
          running: false,
          outcome: describeSimulation(result, action.method),
        },
      }));
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [milestone.id]: {
          running: false,
          outcome: {
            ok: false,
            title: "Couldn't validate on-chain",
            detail: toErrorMessage(err),
          },
        },
      }));
    }
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
        {/* Connector: track + filled portion proportional to paid/total value. */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-[11px] top-6 w-0.5 -translate-x-1/2 rounded-full bg-ink-800"
        >
          <div
            className="absolute inset-x-0 top-0 rounded-full bg-emerald-500/80 transition-all duration-500"
            style={{ height: `${filledPercent}%` }}
          />
        </div>

        {milestones.map((milestone) => {
          const state = nodeState(milestone.status);
          const feedback = actions[milestone.id];
          const busy = feedback?.running ?? false;
          const rowActions = roleActions(role, milestone, project.id);

          return (
            <li key={milestone.id} className="relative flex gap-4 pb-8 last:pb-0">
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-ink-900 ${NODE_DOT_CLASSES[state]}`}
              >
                <NodeIcon state={state} />
              </span>

              <div className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-900/60 p-4 transition-colors hover:border-ink-700">
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

                {rowActions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rowActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(milestone, action)}
                        className={action.className}
                      >
                        {busy && <SpinnerIcon />}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {feedback?.outcome && (
                  <p
                    role="status"
                    className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${
                      feedback.outcome.ok
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                        : "border-red-500/30 bg-red-500/5 text-red-200"
                    }`}
                  >
                    <span className="font-semibold">
                      {feedback.outcome.ok ? "✓" : "✕"} {feedback.outcome.title}.
                    </span>{" "}
                    {feedback.outcome.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Mirrors the timeline rows so loading doesn't shift the layout. */
function TimelineSkeleton() {
  return (
    <div className="relative mt-6">
      <div
        aria-hidden="true"
        className="absolute bottom-6 left-[11px] top-6 w-0.5 -translate-x-1/2 bg-ink-800"
      />
      {[0, 1, 2].map((index) => (
        <div key={index} className="relative flex gap-4 pb-8 last:pb-0">
          <span className="relative z-10 mt-0.5 h-6 w-6 shrink-0 rounded-full border border-ink-800 bg-ink-900" />
          <div className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
