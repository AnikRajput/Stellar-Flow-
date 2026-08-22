/**
 * Role-aware project card — redesigned for premium look.
 *
 *  - `role="client"`     → freelancer avatar/address + escrow/progress bar + next action
 *  - `role="freelancer"` → client avatar/address + next milestone due + status
 *
 * Status badges use semantic green/amber/red/gray set.
 * Addresses are shortened + given a deterministic avatar.
 */

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatStroopsAsUnits, parseStroops, shortenAddress } from "@/utils/format";
import type { Milestone, MilestoneStatus } from "@/types/milestone";
import type { Project, ProjectStatus } from "@/types/project";

type Role = "client" | "freelancer";

interface ProjectCardProps {
  project: Project;
  /** Which side of the escrow this card is viewed from. */
  role: Role;
  /** Optional milestone list. */
  milestones?: Milestone[];
  /** When provided, card becomes clickable. */
  onSelect?: () => void;
}

/** Project status → semantic badge tone. */
export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  active: "green",
  completed: "green",
  disputed: "red",
  cancelled: "gray",
  paused: "amber",
};

/** Milestone status → semantic badge tone. */
export const MILESTONE_TONE: Record<MilestoneStatus, BadgeTone> = {
  pending: "gray",
  submitted: "amber",
  approved: "green",
  paid: "green",
  disputed: "red",
  cancelled: "gray",
};

/** Deterministic avatar tint per address. */
const AVATAR_CLASSES = [
  "bg-accent-500/15 text-accent-300",
  "bg-violet-500/15 text-violet-300",
  "bg-success-500/15 text-success-300",
  "bg-warning-500/15 text-warning-300",
  "bg-error-500/15 text-error-300",
  "bg-surface-4 text-text-secondary",
];

/** Exported for ProjectDetails + milestone components. */
export function avatarClass(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length];
}

/** i128 stroop string → number. */
function toNumber(stroops: string): number {
  return Number(parseStroops(stroops));
}

interface ProgressInfo {
  percent: number;
  label: string;
}

/** Completion % from milestones or escrow funding. */
function projectProgress(
  project: Project,
  milestones: Milestone[],
): ProgressInfo {
  if (milestones.length > 0) {
    const done = milestones.filter(
      (m) => m.status === "approved" || m.status === "paid",
    ).length;
    return {
      percent: Math.round((done / milestones.length) * 100),
      label: `${done}/${milestones.length} milestones`,
    };
  }
  const total = toNumber(project.totalAmount);
  if (total <= 0) {
    return { percent: 0, label: "No escrow" };
  }
  return {
    percent: Math.min(
      100,
      Math.round((toNumber(project.escrowBalance) / total) * 100),
    ),
    label: "Escrow funded",
  };
}

interface ActionInfo {
  text: string;
  tone: "amber" | "green" | "gray";
}

/** Next step a client must take. */
function clientNextAction(
  project: Project,
  milestones: Milestone[],
): ActionInfo {
  if (milestones.some((m) => m.status === "submitted")) {
    return { text: "Review submitted work", tone: "amber" };
  }
  switch (project.status) {
    case "disputed":
      return { text: "Resolve dispute", tone: "amber" };
    case "paused":
      return { text: "Paused", tone: "amber" };
    case "cancelled":
      return { text: "Cancelled", tone: "gray" };
    case "completed":
      return { text: "Completed", tone: "green" };
    case "active":
      break;
  }
  if (milestones.length > 0 && milestones.every((m) => m.status === "paid")) {
    return { text: "All paid", tone: "green" };
  }
  if (toNumber(project.escrowBalance) < toNumber(project.totalAmount)) {
    return { text: "Fund escrow", tone: "amber" };
  }
  return { text: "Awaiting submission", tone: "gray" };
}

/** Earliest pending/submitted milestone by due date. */
function nextMilestone(milestones: Milestone[]): Milestone | null {
  const upcoming = milestones
    .filter((m) => m.status === "pending" || m.status === "submitted")
    .sort((a, b) => a.dueDate - b.dueDate);
  return upcoming[0] ?? null;
}

function formatDue(dueDate: number): string {
  return new Date(dueDate * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const ACTION_TONE_CLASS: Record<ActionInfo["tone"], string> = {
  amber: "text-warning-400",
  green: "text-success-400",
  gray: "text-text-tertiary",
};

export function ProjectCard({
  project,
  role,
  milestones = [],
  onSelect,
}: ProjectCardProps) {
  const counterpartAddress =
    role === "client" ? project.freelancer : project.client;
  const progress = projectProgress(project, milestones);
  const nextAction =
    role === "client" ? clientNextAction(project, milestones) : null;
  const upcoming = role === "freelancer" ? nextMilestone(milestones) : null;
  const overdue = upcoming !== null && upcoming.dueDate * 1000 < Date.now();

  return (
    <article
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open project #${project.id} details` : undefined}
      className={`group relative flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-2/60 p-4 transition-all duration-200 hover:border-border-default hover:bg-surface-3/40 hover:shadow-card ${
        onSelect
          ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400"
          : ""
      }`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent-500/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-text-primary">
            Project #{project.id}
          </h3>
          <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
        </header>

        <div className="mt-3 flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClass(counterpartAddress)}`}
            aria-hidden="true"
          >
            {counterpartAddress.slice(1, 3).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              {role === "client" ? "Freelancer" : "Client"}
            </p>
            <p className="truncate font-mono text-xs text-text-secondary">
              {shortenAddress(counterpartAddress)}
            </p>
          </div>
        </div>

        {role === "client" ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-text-tertiary">
              <span>{progress.label}</span>
              <span className="tabular-nums text-text-secondary">
                {progress.percent}%
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-4">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : upcoming ? (
          <div className="mt-3 rounded-lg border border-border-subtle bg-surface-3/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-text-tertiary">Next milestone</p>
              <Badge tone={MILESTONE_TONE[upcoming.status]}>
                {upcoming.status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs font-medium text-text-primary">
              {upcoming.name}
            </p>
            <p
              className={`mt-0.5 text-[11px] ${
                overdue ? "font-medium text-error-400" : "text-text-tertiary"
              }`}
            >
              {overdue ? "Overdue · Due " : "Due "}
              {formatDue(upcoming.dueDate)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-text-tertiary">
            {milestones.length > 0
              ? "All milestones settled"
              : "No milestone data"}
          </p>
        )}

        <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border-subtle pt-2.5 text-[11px] text-text-tertiary">
          <span className="tabular-nums">
            {formatStroopsAsUnits(project.escrowBalance)} /{" "}
            {formatStroopsAsUnits(project.totalAmount)} XLM
          </span>
          {nextAction && (
            <span className={ACTION_TONE_CLASS[nextAction.tone]}>
              {nextAction.text}
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}

/** Mirrors the ProjectCard layout for loading state. */
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-2.5 w-full rounded" />
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-36 rounded" />
    </div>
  );
}
