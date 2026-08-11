/**
 * Project details page (Phase 10).
 *
 * Assembles: SidebarNav + header strip (client/freelancer avatars joined by an
 * escrow-funded connecting line, status badge, total value) + tabs
 * `Overview | Milestones | Activity | Dispute` (state-driven — no router) +
 * the MilestoneDetailsModal for a selected milestone.
 *
 * The viewer's role is NEVER hardcoded: it is derived by comparing
 * `useWallet().address` to `project.client` / `project.freelancer` inside
 * MilestoneTimeline (client → Approve/Dispute, freelancer → Submit, anyone
 * else → read-only).
 *
 * Honesty rules (mirroring the Dashboard): project + milestone reads are
 * stubbed until Phase 11, so `error` is the expected state and is rendered as
 * a clear error panel — no fabricated data. The Activity tab is a placeholder
 * (real feed in Phase 12); the Dispute tab shows only what `project.status`
 * actually says.
 */

import { useCallback, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { MilestoneDetailsModal } from "@/components/milestone/MilestoneDetailsModal";
import { MilestoneTimeline } from "@/components/milestone/MilestoneTimeline";
import { avatarClass, STATUS_TONE } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { WalletButton } from "@/components/wallet/WalletButton";
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

/** Display labels for the (lowercase) tab ids. */
const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  milestones: "Milestones",
  activity: "Activity",
  dispute: "Dispute",
};

interface ProjectDetailsProps {
  /** Project id (u32). */
  projectId: number;
  /** App-shell nav wiring — forwarded to the page's SidebarNav. */
  onNavigate?: (id: NavItemId) => void;
}

export function ProjectDetails({
  projectId,
  onNavigate,
}: ProjectDetailsProps) {
  const wallet = useWallet();
  const { project, loading, error } = useProject(projectId);
  // Milestones only matter once the project (and its count) is known.
  const {
    milestones,
    loading: milestonesLoading,
    error: milestonesError,
  } = useMilestones(projectId, project?.milestoneCount ?? 0);

  const [tab, setTab] = useState<TabId>("overview");
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(
    null,
  );
  // Stable identity so the modal's Escape-key listener doesn't re-subscribe on
  // every parent render.
  const closeMilestone = useCallback(() => setSelectedMilestone(null), []);

  return (
    <div className="flex min-h-screen">
      <SidebarNav active="projects" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Project #{projectId}
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Escrow details, milestones, and dispute state.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        {loading ? (
          <HeaderStripSkeleton />
        ) : error ? (
          <ProjectErrorState projectId={projectId} message={error.message} />
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
          <ProjectErrorState
            projectId={projectId}
            message="No data returned for this project."
          />
        )}
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

/** Escrow funding % — real on-chain values, used for the header connecting line. */
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
    <section className="mt-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
      <div className="flex flex-wrap items-center gap-5">
        <PartyAvatar role="Client" address={project.client} />

        {/* Connecting line — filled portion = escrow funded / total value. */}
        <div className="min-w-32 flex-1 px-1 sm:px-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-navy-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] tabular-nums text-ink-400">
            {formatStroopsAsUnits(project.escrowBalance)} of{" "}
            {formatStroopsAsUnits(project.totalAmount)} XLM escrowed
          </p>
        </div>

        <PartyAvatar role="Freelancer" address={project.freelancer} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
        <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
        <p className="text-sm text-ink-300">
          Total value{" "}
          <span className="font-semibold tabular-nums text-ink-50">
            {formatStroopsAsUnits(project.totalAmount)} XLM
          </span>
        </p>
      </div>
    </section>
  );
}

function PartyAvatar({ role, address }: { role: string; address: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(address)}`}
        aria-hidden="true"
      >
        {address.slice(1, 3).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {role}
        </p>
        <p className="truncate font-mono text-sm text-ink-100" title={address}>
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
      className="mt-6 flex gap-1 overflow-x-auto border-b border-ink-800"
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
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-navy-500 text-ink-50"
                : "border-transparent text-ink-400 hover:text-ink-200"
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
  // With milestone reads stubbed (Phase 11), an empty list is ambiguous — only
  // claim counts we can actually see.
  const milestonesLoaded = milestones.length > 0 || project.milestoneCount === 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
        <h3 className="text-sm font-semibold text-ink-50">Parties</h3>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Client
            </dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-ink-100">
              {project.client}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Freelancer
            </dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-ink-100">
              {project.freelancer}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Token
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-ink-100">
              {shortenAddress(project.token)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Created
            </dt>
            <dd className="mt-0.5 text-sm text-ink-100">
              {new Date(project.createdAt * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
        <h3 className="text-sm font-semibold text-ink-50">Escrow</h3>
        <dl className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Total value
            </dt>
            <dd className="text-sm tabular-nums text-ink-100">
              {formatStroopsAsUnits(project.totalAmount)} XLM
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Escrowed
            </dt>
            <dd className="text-sm tabular-nums text-ink-100">
              {formatStroopsAsUnits(project.escrowBalance)} XLM
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Funded
            </dt>
            <dd className="text-sm tabular-nums text-ink-100">
              {escrowPercent(project)}%
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Milestones
            </dt>
            <dd className="text-sm tabular-nums text-ink-100">
              {milestonesLoaded ? (
                <>
                  {paidCount} of {project.milestoneCount} paid
                  {paidStroops > 0n &&
                    ` · ${formatStroopsAsUnits(paidStroops.toString())} XLM released`}
                </>
              ) : (
                "Milestone reads pending (Phase 11)"
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
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-10 text-center">
      <p className="text-sm font-medium text-ink-200">Project activity feed</p>
      <p className="mt-1 text-xs text-ink-400">
        On-chain events for this project stream here — wired up in Phase 12.
      </p>
    </div>
  );
}

function DisputePanel({ project }: { project: Project }) {
  if (project.status === "disputed") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
      >
        <p className="text-sm font-semibold text-red-200">
          This project has an active dispute.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
          The disputed milestone is marked in the timeline. Initiator, reason,
          and resolution records land with dispute reads (Phase 12).
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
      <p className="text-sm font-medium text-ink-200">No active disputes</p>
      <p className="mt-1 text-xs text-ink-400">
        Disputes opened from a submitted milestone appear here.
      </p>
    </div>
  );
}

function ProjectErrorState({
  projectId,
  message,
}: {
  projectId: number;
  message: string;
}) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
    >
      <p className="text-sm font-medium text-red-200">
        Couldn't load project #{projectId}.
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
        {message}
      </p>
    </div>
  );
}

function HeaderStripSkeleton() {
  return (
    <section className="mt-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>
        <div className="min-w-32 flex-1 px-1 sm:px-4">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="mx-auto mt-2 h-3 w-44 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-36 rounded-md" />
      </div>
    </section>
  );
}
