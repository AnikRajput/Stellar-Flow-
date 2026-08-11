/**
 * Disputes page (Phase 13).
 *
 * Lists disputes the connected wallet is a party to (client/freelancer) or can
 * arbitrate (the escrow's factory address). Everything is real:
 *
 *   - Dispute records are reconstructed from escrow `DISPUTE_OPENED` /
 *     `DISPUTE_RESOLVED` events (`useContractEvents` — honest RPC polling).
 *   - Each record is enriched with the project (`get_project`) and the
 *     disputed milestone (`get_milestone`) via REAL simulated contract reads
 *     (`useContract`), giving the amount affected and the party check.
 *   - Wallet gating is enforced by WalletGuard; reads/actions fail loudly
 *     with plain-language errors instead of fake data.
 *
 * Known limits (documented in types/dispute.ts): no public dispute reads exist
 * on the escrow contract, so the list covers the recent history window, and an
 * OPEN dispute's id is derived from event order until its resolution event
 * lands with the authoritative id.
 */

import { useEffect, useMemo, useState } from "react";
import { nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { DisputeCard } from "@/components/dispute/DisputeCard";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { WalletButton } from "@/components/wallet/WalletButton";
import { WalletGuard } from "@/components/wallet/WalletGuard";
import { CONTRACTS } from "@/config/contracts";
import { useContract } from "@/hooks/useContract";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useWallet } from "@/hooks/useWallet";
import type { DisputeRecord } from "@/types/dispute";
import type { ContractEvent } from "@/types/event";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import type { Project, ProjectStatus } from "@/types/project";

interface DisputesProps {
  /** App-shell nav wiring — forwarded to the page's SidebarNav. */
  onNavigate?: (id: NavItemId) => void;
}

/** Enrichment from the per-record contract reads (optional — cards degrade to "—"). */
interface ReadDetails {
  projects: Record<number, Project>;
  milestones: Record<string, Milestone>;
}

function milestoneKey(projectId: number, milestoneId: number): string {
  return `${projectId}:${milestoneId}`;
}

export function Disputes({ onNavigate }: DisputesProps) {
  const wallet = useWallet();
  const { address } = wallet;
  const { events, loading } = useContractEvents(CONTRACTS.escrow);
  const { call } = useContract();

  const records = useMemo(() => buildDisputeRecords(events), [events]);
  // Stable identity for the enrichment effect — only re-fetches when the set
  // of disputes actually changes (new event polled in).
  const recordsKey = useMemo(
    () =>
      records
        .map((r) => `${r.projectId}:${r.milestoneId}:${r.openedLedger}:${r.resolvedLedger ?? 0}`)
        .join("|"),
    [records],
  );

  const [details, setDetails] = useState<ReadDetails>({
    projects: {},
    milestones: {},
  });
  // Set when any enrichment read failed — the party filter then falls back to
  // the event initiator, so disputes opened by the other party may be missing.
  const [readFailed, setReadFailed] = useState(false);
  // Increment to re-run the enrichment reads (the notice's Retry button).
  const [readAttempt, setReadAttempt] = useState(0);

  // Enrich each dispute with real get_project / get_milestone reads. Failures
  // (RPC down, contract not deployed) leave the card visible with "—" values —
  // the dispute itself still renders from its events.
  useEffect(() => {
    if (!address || records.length === 0) return;
    let active = true;
    setReadFailed(false);

    void (async () => {
      for (const record of records) {
        if (!active) return;

        try {
          const simulation = (await call(CONTRACTS.escrow, "get_project", [
            nativeToScVal(record.projectId, { type: "u32" }),
          ])) as rpc.Api.SimulateTransactionResponse;
          if (active && rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
            const project = decodeProjectRecord(
              scValToNative(simulation.result.retval),
            );
            setDetails((prev) => ({
              ...prev,
              projects: { ...prev.projects, [record.projectId]: project },
            }));
          }
        } catch {
          // Enrichment is optional — keep the card from its events, but flag
          // the failure so the UI can explain missing details.
          if (active) setReadFailed(true);
        }

        if (record.milestoneId <= 0) continue;
        try {
          const simulation = (await call(CONTRACTS.escrow, "get_milestone", [
            nativeToScVal(record.projectId, { type: "u32" }),
            nativeToScVal(record.milestoneId, { type: "u32" }),
          ])) as rpc.Api.SimulateTransactionResponse;
          if (active && rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
            const milestone = decodeMilestoneRecord(
              scValToNative(simulation.result.retval),
            );
            setDetails((prev) => ({
              ...prev,
              milestones: {
                ...prev.milestones,
                [milestoneKey(record.projectId, record.milestoneId)]: milestone,
              },
            }));
          }
        } catch {
          // Same as above.
          if (active) setReadFailed(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [recordsKey, records, address, call, readAttempt]);

  // The escrow contract authorizes resolution only to the stored factory
  // address (require_factory_admin) — the configured factory IS that value.
  const isArbitrator = Boolean(address) && address === CONTRACTS.factory;

  const visible = useMemo(() => {
    if (!address) return [];
    return records.filter((record) => {
      if (isArbitrator) return true;
      // Party check from real project reads (client/freelancer); falls back to
      // the event's initiator while a read hasn't landed.
      if (record.initiator && record.initiator === address) return true;
      const project = details.projects[record.projectId];
      return Boolean(
        project &&
          (project.client === address || project.freelancer === address),
      );
    });
  }, [records, address, isArbitrator, details.projects]);

  return (
    <div className="flex min-h-screen">
      <SidebarNav active="disputes" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Disputes
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Cases you're a party to, and every case you can arbitrate.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        <WalletGuard>
          <section className="mt-6">
            {loading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {[0, 1, 2].map((index) => (
                  <DisputeCardSkeleton key={index} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState isArbitrator={isArbitrator} />
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  {visible.map((record) => (
                    <DisputeCard
                      key={milestoneKey(record.projectId, record.milestoneId)}
                      dispute={record}
                      project={details.projects[record.projectId]}
                      milestone={
                        details.milestones[
                          milestoneKey(record.projectId, record.milestoneId)
                        ]
                      }
                    />
                  ))}
                </div>
                {readFailed && (
                  <div
                    role="alert"
                    className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
                  >
                    <p className="text-xs leading-relaxed text-amber-200/90">
                      Some dispute details couldn't be loaded (project/milestone
                      reads failed). Disputes opened by the other party may be
                      missing until these reads succeed.
                    </p>
                    <button
                      type="button"
                      onClick={() => setReadAttempt((attempt) => attempt + 1)}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:bg-ink-700"
                    >
                      <RetryIcon className="h-3.5 w-3.5" />
                      Retry loading details
                    </button>
                  </div>
                )}

                <p className="mt-6 text-xs leading-relaxed text-ink-500">
                  Disputes are reconstructed from escrow contract events.
                  Cases older than the recent history window aren't listed, and
                  an open case's dispute id is derived from event order — the
                  contract publishes the authoritative id only when the case is
                  resolved.
                </p>
              </>
            )}
          </section>
        </WalletGuard>
      </main>
    </div>
  );
}

/* ------------------------- record reconstruction ------------------------- */

/** DISPUTE_OPENED payload (narrowed union member). */
type OpenedEvent = ContractEvent & { topic: "DISPUTE_OPENED" };
/** DISPUTE_RESOLVED payload (narrowed union member). */
type ResolvedEvent = ContractEvent & { topic: "DISPUTE_RESOLVED" };

/**
 * Reconstructs dispute records from escrow events.
 *
 * Pairing: a project can host at most one dispute (opening requires an Active
 * project; resolution is terminal), so resolved events join by `projectId`.
 * Dispute ids are a global counter; the 1-based position of an opened event
 * within this history approximates the id until the authoritative id arrives
 * with the resolution event (see types/dispute.ts).
 */
function buildDisputeRecords(events: ContractEvent[]): DisputeRecord[] {
  const opened = events
    .filter((event): event is OpenedEvent => event.topic === "DISPUTE_OPENED")
    .sort(
      (a, b) => a.ledger - b.ledger || a.data.timestamp - b.data.timestamp,
    );

  const resolvedByProject = new Map<number, ResolvedEvent>();
  for (const event of events) {
    if (
      event.topic === "DISPUTE_RESOLVED" &&
      !resolvedByProject.has(event.data.projectId)
    ) {
      resolvedByProject.set(event.data.projectId, event);
    }
  }

  const records: DisputeRecord[] = opened.map((event, index) => {
    const resolved = resolvedByProject.get(event.data.projectId);
    return {
      projectId: event.data.projectId,
      milestoneId: event.data.milestoneId,
      // Authoritative id once resolved; order-derived approximation while open.
      disputeId: resolved?.data.disputeId ?? index + 1,
      disputeIdAuthoritative: Boolean(resolved),
      initiator: event.data.initiator,
      reason: event.data.reason,
      openedAt: event.data.timestamp,
      openedLedger: event.ledger,
      openedTxHash: event.txHash,
      resolved: Boolean(resolved),
      outcome: resolved?.data.outcome ?? null,
      resolvedAt: resolved?.data.timestamp ?? null,
      resolvedLedger: resolved?.ledger ?? null,
      resolvedTxHash: resolved?.txHash ?? null,
    };
  });

  // Resolved disputes whose opening fell outside the recent history window —
  // shown honestly without initiator/reason/milestone.
  for (const [projectId, event] of resolvedByProject) {
    if (!records.some((record) => record.projectId === projectId)) {
      records.push({
        projectId,
        milestoneId: 0,
        disputeId: event.data.disputeId,
        disputeIdAuthoritative: true,
        initiator: "",
        reason: "",
        openedAt: 0,
        openedLedger: 0,
        openedTxHash: "",
        resolved: true,
        outcome: event.data.outcome,
        resolvedAt: event.data.timestamp,
        resolvedLedger: event.ledger,
        resolvedTxHash: event.txHash,
      });
    }
  }

  return records.sort(
    (a, b) =>
      (b.openedAt || b.resolvedAt || 0) - (a.openedAt || a.resolvedAt || 0),
  );
}

/* --------------------------- retval decoding ----------------------------- */

/** ProjectStatus variants in declaration order (contracts/escrow/src/types.rs). */
const PROJECT_STATUS_ORDER = [
  "active",
  "completed",
  "disputed",
  "cancelled",
  "paused",
] as const;

/** MilestoneStatus variants in declaration order (contracts/escrow/src/types.rs). */
const MILESTONE_STATUS_ORDER = [
  "pending",
  "submitted",
  "approved",
  "paid",
  "disputed",
  "cancelled",
] as const;

/**
 * Contracttype enums decode as a u32 discriminant (the same convention the
 * events service documents for `DisputeOutcome`); tolerate the string variant
 * form as well.
 */
function decodeEnumStatus(
  value: unknown,
  order: readonly string[],
): string {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  const index = Number(value);
  if (Number.isInteger(index) && order[index]) {
    return order[index];
  }
  // Defensive fallback — the contract only ever writes valid discriminants.
  return order[0] ?? "pending";
}

function decodeProjectRecord(value: unknown): Project {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: Number(raw.id),
    client: String(raw.client),
    freelancer: String(raw.freelancer),
    token: String(raw.token),
    totalAmount: String(raw.total_amount),
    escrowBalance: String(raw.escrow_balance),
    status: decodeEnumStatus(raw.status, PROJECT_STATUS_ORDER) as ProjectStatus,
    milestoneCount: Number(raw.milestone_count),
    createdAt: Number(raw.created_at),
  };
}

function decodeMilestoneRecord(value: unknown): Milestone {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: Number(raw.id),
    name: String(raw.name),
    amount: String(raw.amount),
    status: decodeEnumStatus(
      raw.status,
      MILESTONE_STATUS_ORDER,
    ) as MilestoneStatus,
    dueDate: Number(raw.due_date),
  };
}

/* ------------------------------ empty / loading -------------------------- */

function EmptyState({ isArbitrator }: { isArbitrator: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
      <p className="text-sm font-medium text-ink-200">
        {isArbitrator
          ? "No disputes in the recent history window"
          : "No disputes yet"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
        {isArbitrator
          ? "Every case the escrow emitted appears here for arbitration."
          : "Disputes opened from a submitted milestone appear here, plus every case you can arbitrate."}
      </p>
    </div>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

/** Mirrors the card layout so loading doesn't shift the grid. */
function DisputeCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44 rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-24 rounded-xl" />
    </div>
  );
}
