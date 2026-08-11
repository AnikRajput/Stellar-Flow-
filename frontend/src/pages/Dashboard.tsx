/**
 * Dashboard (Phase 8).
 *
 * Assembles: SidebarNav + 4 StatCards + a role-filtered ProjectCard grid +
 * a LIVE activity panel (real escrow events via `useContractEvents` — new
 * on-chain events append without a page reload).
 *
 * Data honesty rules:
 *  - While `useProjects().loading` → Skeleton stat values + skeleton cards.
 *  - On error → clear error state with a Retry button (reads are stubbed until
 *    Phase 9/11, so this is the expected state for now — no fake data).
 *  - "Total Paid" and "Pending Milestones" are not derivable from the Phase 6
 *    `Project` struct, so they render "—" with an honest context line instead
 *    of inventing numbers. They get real values once milestone/paid reads land.
 */

import { useMemo } from "react";
import { ActivityFeedRow } from "@/components/activity/ActivityFeedRow";
import { SidebarNav } from "@/components/layout/SidebarNav";
import {
  ProjectCard,
  ProjectCardSkeleton,
} from "@/components/project/ProjectCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACTS } from "@/config/contracts";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useProjects } from "@/hooks/useProjects";
import { useWallet } from "@/hooks/useWallet";
import { formatStroopsAsUnits, parseStroops } from "@/utils/format";

type Role = "client" | "freelancer";

interface DashboardProps {
  /** Which side of the escrow the dashboard summarizes. Defaults to "client". */
  role?: Role;
}

export function Dashboard({ role = "client" }: DashboardProps) {
  // Used by WalletButton; useProjects() also creates an instance internally.
  // Independent instances are fine — Freighter reads are idempotent and there
  // is no shared mutable state (a context could consolidate this in a later
  // phase).
  const wallet = useWallet();
  const { projects, loading, error, refetch } = useProjects(role);
  // Live escrow events — independent of the stubbed project reads, so the
  // activity panel shows REAL on-chain activity while the grid below is still
  // in its error state this phase.
  const { events: activityEvents, loading: activityLoading } = useContractEvents(
    CONTRACTS.escrow,
  );

  const activeCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects],
  );

  const totalEscrowedStroops = useMemo(
    () => projects.reduce((sum, p) => sum + parseStroops(p.escrowBalance), 0n),
    [projects],
  );

  // While loading, stat values swap to Skeletons; on error they swap to "—"
  // (an error means we don't know the numbers, and 0 would be misleading).
  const statValue = (value: string) =>
    loading ? <Skeleton className="h-7 w-16 rounded-md" /> : error ? "—" : value;
  // Cards whose value is never available this phase (no milestone/paid reads)
  // still pulse during load so all four cards look consistent.
  const unavailableValue = loading ? (
    <Skeleton className="h-7 w-16 rounded-md" />
  ) : (
    "—"
  );

  return (
    <div className="flex min-h-screen">
      <SidebarNav active="dashboard" />

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Escrow and milestone overview for your projects.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        <section
          className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Overview stats"
        >
          <StatCard
            label="Active Projects"
            value={statValue(String(activeCount))}
            context={
              error
                ? "Unavailable while reads are down"
                : `${projects.length} total in list`
            }
            icon={<ProjectsIcon />}
            tone="green"
          />
          <StatCard
            label="Total Escrowed"
            value={statValue(
              formatStroopsAsUnits(totalEscrowedStroops.toString()),
            )}
            context={
              error
                ? "Unavailable while reads are down"
                : `Across ${projects.length} project${projects.length === 1 ? "" : "s"}`
            }
            icon={<VaultIcon />}
            tone="navy"
          />
          <StatCard
            label="Total Paid"
            value={unavailableValue}
            context="Wired up with milestone reads (Phase 9)"
            icon={<PaidIcon />}
            tone="accent"
          />
          <StatCard
            label="Pending Milestones"
            value={unavailableValue}
            context="Wired up with milestone reads (Phase 9)"
            icon={<MilestoneIcon />}
            tone="amber"
          />
        </section>

        <section className="mt-10" aria-label="Your projects">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink-50">Your Projects</h2>
            <span className="text-xs text-ink-400">Viewing as {role}</span>
          </div>

          {loading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <ProjectsErrorState message={error.message} onRetry={refetch} />
          ) : projects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink-700 p-10 text-center">
              <p className="text-sm font-medium text-ink-200">
                No {role} projects yet
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Projects you create or join will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} role={role} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10" aria-label="Activity">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink-50">Activity</h2>
            <span className="text-xs text-ink-400">
              Live — polls the RPC every ~5s
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {activityLoading ? (
              <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="mt-2 h-12 w-full rounded-lg" />
                <Skeleton className="mt-2 h-12 w-full rounded-lg" />
              </div>
            ) : activityEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-700 p-8 text-center">
                <ActivityIcon className="mx-auto h-6 w-6 text-ink-500" />
                <p className="mt-3 text-sm font-medium text-ink-200">
                  No activity yet
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Events emitted by the escrow contract appear here as they
                  land on-chain.
                </p>
              </div>
            ) : (
              activityEvents.slice(0, 8).map((event, index) => (
                <ActivityFeedRow
                  key={`${event.ledger}:${event.txHash}:${event.topic}:${index}`}
                  event={event}
                  compact
                />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProjectsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
    >
      <p className="text-sm font-medium text-red-200">
        Couldn't load your projects.
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700 hover:text-ink-50"
      >
        <RetryIcon className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

function ProjectsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 9h3" />
      <path d="M3 15h3" />
      <path d="M18 9h3" />
      <path d="M18 15h3" />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function MilestoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v18" />
      <path d="M5 5h11l-2 3 2 3H5" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
