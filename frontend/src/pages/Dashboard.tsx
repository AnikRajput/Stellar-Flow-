/**
 * Dashboard — redesigned for premium SaaS/Web3 look.
 *
 * Hero greeting → compact stat cards → project grid → live activity panel.
 * Data honesty rules preserved: skeletons while loading, error states on failure,
 * never fabricated data.
 */

import { useMemo } from "react";
import { ActivityFeedRow } from "@/components/activity/ActivityFeedRow";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import {
  ProjectCard,
  ProjectCardSkeleton,
} from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useProjects } from "@/hooks/useProjects";
import { useWallet } from "@/hooks/useWallet";
import { formatStroopsAsUnits, parseStroops } from "@/utils/format";
import { CONTRACTS } from "@/config/contracts";

type Role = "client" | "freelancer";

interface DashboardProps {
  role?: Role;
  onNavigate?: (id: NavItemId) => void;
  onOpenProject?: (projectId: number) => void;
  onCreateProject?: () => void;
}

export function Dashboard({
  role = "client",
  onNavigate,
  onOpenProject,
  onCreateProject,
}: DashboardProps) {
  const wallet = useWallet();
  const { projects, loading, error, refetch } = useProjects(role);
  const { events: activityEvents, loading: activityLoading } =
    useContractEvents(CONTRACTS.escrow);

  const activeCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects],
  );

  const totalEscrowedStroops = useMemo(
    () =>
      projects.reduce((sum, p) => sum + parseStroops(p.escrowBalance), 0n),
    [projects],
  );

  // Skeleton while loading, "—" on error
  const statValue = (value: string) =>
    loading ? (
      <Skeleton className="h-7 w-16 rounded" />
    ) : error ? (
      "—"
    ) : (
      value
    );

  const unavailableValue = loading ? (
    <Skeleton className="h-7 w-16 rounded" />
  ) : (
    "—"
  );

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav active="dashboard" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1">
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-border-subtle bg-hero-gradient px-6 py-8 lg:px-8">
          {/* Background decoration */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent-500/[0.03] blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-500/[0.02] blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                {getGreeting()} 👋
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Here's what's happening with your projects today.
              </p>
            </div>

            {onCreateProject && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-gradient px-4 py-2.5 text-[13px] font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 active:scale-[0.98]"
                >
                  <PlusIcon className="h-4 w-4" />
                  New Project
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-6 lg:px-8">
          {/* Stats Grid */}
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Overview stats"
          >
            <StatCard
              label="Active Projects"
              value={statValue(String(activeCount))}
              context={
                error
                  ? "Unavailable"
                  : `${projects.length} total`
              }
              icon={<ProjectsIcon />}
              tone="accent"
              trend={
                !loading && !error && projects.length > 0
                  ? { value: "from list", direction: "neutral" }
                  : undefined
              }
            />
            <StatCard
              label="Total Escrowed"
              value={statValue(
                formatStroopsAsUnits(totalEscrowedStroops.toString()),
              )}
              context={
                error
                  ? "Unavailable"
                  : `Across ${projects.length} project${projects.length === 1 ? "" : "s"}`
              }
              icon={<VaultIcon />}
              tone="purple"
            />
            <StatCard
              label="Total Paid"
              value={unavailableValue}
              context="Milestone reads pending"
              icon={<PaidIcon />}
              tone="green"
            />
            <StatCard
              label="Pending Milestones"
              value={unavailableValue}
              context="Milestone reads pending"
              icon={<MilestoneIcon />}
              tone="amber"
            />
          </section>

          {/* Projects Section */}
          <section className="mt-8" aria-label="Your projects">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                Your Projects
              </h2>
              <span className="text-[11px] text-text-tertiary">
                Viewing as {role}
              </span>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <ProjectCardSkeleton key={i} />
                  ))}
                </div>
              ) : error ? (
                <ErrorState
                  title="Couldn't load your projects"
                  message={error.message}
                  onRetry={refetch}
                />
              ) : projects.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                      <path d="M12 11v6" />
                      <path d="M9 14h6" />
                    </svg>
                  }
                  title="No projects yet"
                  description="Create your first escrow project and securely manage payments through milestones."
                  action={
                    onCreateProject
                      ? {
                          label: "Create Your First Project",
                          onClick: onCreateProject,
                          icon: (
                            <PlusIcon className="h-4 w-4" />
                          ),
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      role={role}
                      onSelect={
                        onOpenProject
                          ? () => onOpenProject(project.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Activity Section */}
          <section className="mt-8" aria-label="Activity">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                Recent Activity
              </h2>
              <span className="text-[11px] text-text-tertiary">
                Live · polls RPC every ~5s
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {activityLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border-subtle bg-surface-2/60 p-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-3/4 rounded" />
                          <Skeleton className="h-2.5 w-1/2 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityEvents.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12h4l2-7 4 14 2-7h6" />
                    </svg>
                  }
                  title="No activity yet"
                  description="Events emitted by the escrow contract appear here as they land on-chain."
                />
              ) : (
                <>
                  {activityEvents.slice(0, 6).map((event, index) => (
                    <ActivityFeedRow
                      key={`${event.ledger}:${event.txHash}:${event.topic}:${index}`}
                      event={event}
                      compact
                    />
                  ))}
                  {activityEvents.length > 6 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.("activity")}
                      className="w-full rounded-xl border border-border-subtle bg-surface-2/40 py-2.5 text-center text-[12px] font-medium text-accent-400 transition-all duration-200 hover:border-border-default hover:bg-surface-3/40"
                    >
                      View All Activity ({activityEvents.length})
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* --------------------------------- Icons --------------------------------- */

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function MilestoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v18" />
      <path d="M5 5h11l-2 3 2 3H5" />
    </svg>
  );
}
