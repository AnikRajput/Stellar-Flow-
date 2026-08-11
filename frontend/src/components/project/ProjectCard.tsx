/**
 * Role-aware project card.
 *
 *  - `role="client"`     → freelancer avatar/address + escrow/progress bar +
 *                          next action needed
 *  - `role="freelancer"` → client avatar/address + next milestone due + status
 *
 * Status badges use the semantic green/amber/red/gray set — never the brand
 * accent. Addresses are shortened + given a deterministic avatar because no
 * profile names exist on-chain yet; nothing here fabricates data.
 *
 * The optional `milestones` prop refines progress/next-step details. No hook
 * returns milestones in Phase 8, so without it the card falls back to escrow
 * funding + status-based text.
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
  /**
   * Optional milestone list (reads land in Phase 9). When omitted, progress is
   * derived from escrow funding and no milestone-level details are claimed.
   */
  milestones?: Milestone[];
  /**
   * When provided, the card becomes a keyboard-accessible button that calls
   * this handler (app shell navigates to the project's details).
   */
  onSelect?: () => void;
}

/**
 * Project status → semantic badge tone.
 * Exported for ProjectDetails + milestone components to reuse the same set.
 */
export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  active: "green",
  completed: "green",
  disputed: "red",
  cancelled: "gray",
  paused: "amber",
};

/**
 * Milestone status → semantic badge tone.
 * Exported for milestone components to reuse the same set.
 */
export const MILESTONE_TONE: Record<MilestoneStatus, BadgeTone> = {
  pending: "gray",
  submitted: "amber",
  approved: "green",
  paid: "green",
  disputed: "red",
  cancelled: "gray",
};

/** Deterministic avatar tint per address (stable across renders). */
const AVATAR_CLASSES = [
  "bg-navy-600/40 text-navy-200",
  "bg-accent-500/20 text-accent-200",
  "bg-emerald-600/30 text-emerald-200",
  "bg-amber-600/30 text-amber-200",
  "bg-red-600/30 text-red-200",
  "bg-ink-700 text-ink-200",
];

/** Exported for ProjectDetails + milestone components to reuse the same avatar. */
export function avatarClass(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length];
}

/** i128 stroop string → number (0 on malformed input, see `parseStroops`). */
function toNumber(stroops: string): number {
  return Number(parseStroops(stroops));
}

interface ProgressInfo {
  percent: number;
  label: string;
}

/** Completion % from milestones when available, else escrow funding %. */
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
      label: `${done}/${milestones.length} milestones complete`,
    };
  }
  const total = toNumber(project.totalAmount);
  if (total <= 0) {
    return { percent: 0, label: "Escrow funded" };
  }
  return {
    percent: Math.min(100, Math.round((toNumber(project.escrowBalance) / total) * 100)),
    label: "Escrow funded",
  };
}

interface ActionInfo {
  text: string;
  tone: "amber" | "green" | "gray";
}

/** Next step a client must take, derived from real project/milestone state. */
function clientNextAction(
  project: Project,
  milestones: Milestone[],
): ActionInfo {
  if (milestones.some((m) => m.status === "submitted")) {
    return { text: "Approve submitted work", tone: "amber" };
  }
  switch (project.status) {
    case "disputed":
      return { text: "Resolve active dispute", tone: "amber" };
    case "paused":
      return { text: "Paused — needs review", tone: "amber" };
    case "cancelled":
      return { text: "Cancelled", tone: "gray" };
    case "completed":
      return { text: "Completed — all settled", tone: "green" };
    case "active":
      break;
  }
  if (
    milestones.length > 0 &&
    milestones.every((m) => m.status === "paid")
  ) {
    return { text: "All milestones paid", tone: "green" };
  }
  if (toNumber(project.escrowBalance) < toNumber(project.totalAmount)) {
    return { text: "Fund remaining escrow", tone: "amber" };
  }
  return { text: "Escrow funded — awaiting submission", tone: "gray" };
}

/** Earliest pending/submitted milestone by due date, or null. */
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
  amber: "font-medium text-amber-300",
  green: "font-medium text-emerald-300",
  gray: "text-ink-400",
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
  const nextAction = role === "client" ? clientNextAction(project, milestones) : null;
  const upcoming = role === "freelancer" ? nextMilestone(milestones) : null;
  const overdue =
    upcoming !== null && upcoming.dueDate * 1000 < Date.now();

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
      className={`flex flex-col gap-4 rounded-2xl border border-ink-800 bg-ink-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-ink-700 hover:shadow-glow ${
        onSelect ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-400" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-50">
          Project #{project.id}
        </h3>
        <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
      </header>

      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(counterpartAddress)}`}
          aria-hidden="true"
        >
          {counterpartAddress.slice(1, 3).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {role === "client" ? "Freelancer" : "Client"}
          </p>
          <p className="truncate font-mono text-sm text-ink-100">
            {shortenAddress(counterpartAddress)}
          </p>
        </div>
      </div>

      {role === "client" ? (
        <div>
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>{progress.label}</span>
            <span className="tabular-nums text-ink-200">{progress.percent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-navy-500 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : upcoming ? (
        <div className="rounded-lg border border-ink-800 bg-ink-800/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-400">Next milestone</p>
            <Badge tone={MILESTONE_TONE[upcoming.status]}>
              {upcoming.status}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-ink-100">
            {upcoming.name}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              overdue ? "font-medium text-red-300" : "text-ink-400"
            }`}
          >
            {overdue ? "Overdue — was due " : "Due "}
            {formatDue(upcoming.dueDate)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-400">
          {milestones.length > 0
            ? "All milestones settled."
            : "Milestone reads land in Phase 9."}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ink-800 pt-3 text-xs text-ink-400">
        <span className="tabular-nums">
          {formatStroopsAsUnits(project.escrowBalance)} /{" "}
          {formatStroopsAsUnits(project.totalAmount)} XLM escrowed
        </span>
        {nextAction && (
          <span className={ACTION_TONE_CLASS[nextAction.tone]}>
            {nextAction.text}
          </span>
        )}
      </footer>
    </article>
  );
}

/** Mirrors the ProjectCard layout so loading state doesn't shift the grid. */
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-4 w-40 rounded-md" />
    </div>
  );
}
