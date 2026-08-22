/**
 * Project details page — redesigned for premium look.
 *
 * Assembles: SidebarNav + header strip + tabs + content.
 * Role-awareness preserved: viewer's role derived from wallet address.
 */

import { useCallback, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { TopHeader } from "@/components/layout/TopHeader";
import { MilestoneDetailsModal } from "@/components/milestone/MilestoneDetailsModal";
import { MilestoneTimeline } from "@/components/milestone/MilestoneTimeline";
import { avatarClass, STATUS_TONE } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMilestones } from "@/hooks/useMilestones";
import { useProject } from "@/hooks/useProject";
import { useWallet } from "@/hooks/useWallet";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";
import {
  formatStroopsAsUnits,
  parseStroops,
  shortenAddress,
} from "@/utils/format";

const TABS = ["overview", "milestones", "activity", "dispute"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  milestones: "Milestones",
  activity: "Activity",
  dispute: "Dispute",
};

interface ProjectDetailsProps {
  projectId: number;
  onNavigate?: (id: NavItemId) => void;
}

export function ProjectDetails({ projectId, onNavigate }: ProjectDetailsProps) {
  const wallet = useWallet();
  const { project, loading, error } = useProject(projectId);
  const {
    milestones,
    loading: milestonesLoading,
    error: milestonesError,
  } = useMilestones(projectId, project?.milestoneCount ?? 0);

  const [tab, setTab] = useState<TabId>("overview");
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(
    null,
  );
  const closeMilestone = useCallback(() => setSelectedMilestone(null), []);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav active="projects" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1">
        <TopHeader
          title={`Project #${projectId}`}
          subtitle="Escrow details, milestones, and dispute state."
          wallet={wallet}
        />

        <div className="px-6 py-6 lg:px-8">
          {loading ? (
            <HeaderStripSkeleton />
          ) : error ? (
            <ErrorState
              title={`Couldn't load project #${projectId}`}
              message={error.message}
            />
          ) : project ? (
            <>
              <HeaderStrip project={project} />

              <Tabs current={tab} onChange={setTab} />

              <section
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                className="mt-6"
              >
                {tab === "overview" && (
                  <Overview project={project} milestones={milestones} />
                )}
                {tab === "milestones" && (
                  <MilestoneTimeline
                    project={project}
                    milestones={milestones}
                    loading={milestonesLoading}
                    error={milestonesError}
                    onOpenDetails={setSelectedMilestone}
                  />
                )}
                {tab === "activity" && <ActivityPanel />}
                {tab === "dispute" && <DisputePanel project={project} />}
              </section>
            </>
          ) : (
            <ErrorState
              title={`Project #${projectId}`}
              message="No data returned for this project."
            />
          )}
        </div>
      </main>

      {selectedMilestone && (
        <MilestoneDetailsModal
          milestone={selectedMilestone}
          onClose={closeMilestone}
        />
      )}
    </div>
  );
}

function escrowPercent(project: Project): number {
  const total = parseStroops(project.totalAmount);
  if (total <= 0n) {
    return 0;
  }
  return Math.min(
    100,
    Number((parseStroops(project.escrowBalance) * 100n) / total),
  );
}

function HeaderStrip({ project }: { project: Project }) {
  const percent = escrowPercent(project);
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
        <PartyAvatar role="Client" address={project.client} />

        <div className="w-full px-0 sm:min-w-32 sm:flex-1 sm:px-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
            <div
              className="h-full rounded-full bg-accent-gradient transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] tabular-nums text-text-tertiary">
            {formatStroopsAsUnits(project.escrowBalance)} of{" "}
            {formatStroopsAsUnits(project.totalAmount)} XLM escrowed
          </p>
        </div>

        <PartyAvatar role="Freelancer" address={project.freelancer} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
        <p className="text-[13px] text-text-secondary">
          Total value{" "}
          <span className="font-semibold tabular-nums text-text-primary">
            {formatStroopsAsUnits(project.totalAmount)} XLM
          </span>
        </p>
      </div>
    </section>
  );
}

function PartyAvatar({ role, address }: { role: string; address: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClass(address)}`}
        aria-hidden="true"
      >
        {address.slice(1, 3).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          {role}
        </p>
        <p
          className="truncate font-mono text-[13px] text-text-secondary"
          title={address}
        >
          {shortenAddress(address)}
        </p>
      </div>
    </div>
  );
}

function Tabs({
  current,
  onChange,
}: {
  current: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project sections"
      className="mt-5 flex gap-1 overflow-x-auto border-b border-border-subtle"
    >
      {TABS.map((tab) => {
        const isActive = tab === current;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab}`}
            onClick={() => onChange(tab)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? "border-accent-500 text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}

function Overview({
  project,
  milestones,
}: {
  project: Project;
  milestones: Milestone[];
}) {
  const paidCount = milestones.filter((m) => m.status === "paid").length;
  const paidStroops = milestones.reduce(
    (sum, m) => (m.status === "paid" ? sum + parseStroops(m.amount) : sum),
    0n,
  );
  const milestonesLoaded =
    milestones.length > 0 || project.milestoneCount === 0;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="rounded-xl border border-border-subtle bg-surface-2/60 p-4">
        <h3 className="text-[13px] font-semibold text-text-primary">
          Parties
        </h3>
        <dl className="mt-3 space-y-2.5">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Client
            </dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-text-secondary">
              {project.client}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Freelancer
            </dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-text-secondary">
              {project.freelancer}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Token
            </dt>
            <dd className="mt-0.5 font-mono text-[11px] text-text-secondary">
              {shortenAddress(project.token)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Created
            </dt>
            <dd className="mt-0.5 text-[13px] text-text-secondary">
              {new Date(project.createdAt * 1000).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                },
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-2/60 p-4">
        <h3 className="text-[13px] font-semibold text-text-primary">
          Escrow
        </h3>
        <dl className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Total value
            </dt>
            <dd className="text-[13px] tabular-nums text-text-secondary">
              {formatStroopsAsUnits(project.totalAmount)} XLM
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Escrowed
            </dt>
            <dd className="text-[13px] tabular-nums text-text-secondary">
              {formatStroopsAsUnits(project.escrowBalance)} XLM
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Funded
            </dt>
            <dd className="text-[13px] tabular-nums text-text-secondary">
              {escrowPercent(project)}%
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Milestones
            </dt>
            <dd className="text-[13px] tabular-nums text-text-secondary">
              {milestonesLoaded ? (
                <>
                  {paidCount} of {project.milestoneCount} paid
                  {paidStroops > 0n &&
                    ` · ${formatStroopsAsUnits(paidStroops.toString())} XLM released`}
                </>
              ) : (
                "Milestone reads pending"
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function ActivityPanel() {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      }
      title="Project activity feed"
      description="On-chain events for this project stream here."
    />
  );
}

function DisputePanel({ project }: { project: Project }) {
  if (project.status === "disputed") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-error-500/20 bg-error-500/5 p-6 text-center"
      >
        <p className="text-sm font-semibold text-error-300">
          This project has an active dispute.
        </p>
        <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-text-secondary">
          The disputed milestone is marked in the timeline. Initiator, reason,
          and resolution records land with dispute reads.
        </p>
      </div>
    );
  }
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      }
      title="No active disputes"
      description="Disputes opened from a submitted milestone appear here."
    />
  );
}

function HeaderStripSkeleton() {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
        </div>
        <div className="w-full px-0 sm:min-w-32 sm:flex-1 sm:px-4">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="mx-auto mt-2 h-3 w-44 rounded" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3.5 w-36 rounded" />
      </div>
    </section>
  );
}
