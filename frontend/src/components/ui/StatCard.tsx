import type { ReactNode } from "react";

/** Icon-chip tones */
export type StatTone = "accent" | "green" | "amber" | "purple";

interface StatCardProps {
  /** Short label above the value (e.g. "Active Projects"). */
  label: string;
  /** Formatted value — pass a `Skeleton` here while data is loading. */
  value: ReactNode;
  /** Optional context line under the value (e.g. "2 awaiting approval"). */
  context?: ReactNode;
  /** Optional icon rendered in a tinted chip. */
  icon?: ReactNode;
  /** Icon-chip tone. Defaults to `accent`. */
  tone?: StatTone;
  /** Optional trend indicator (e.g. "+20% from last month"). */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

const CHIP_CLASSES: Record<StatTone, string> = {
  accent: "bg-accent-500/10 text-accent-400",
  green: "bg-success-500/10 text-success-400",
  amber: "bg-warning-500/10 text-warning-400",
  purple: "bg-violet-500/10 text-violet-400",
};

const ICON_BG: Record<StatTone, string> = {
  accent: "from-accent-500/20 to-violet-500/10",
  green: "from-success-500/20 to-emerald-500/10",
  amber: "from-warning-500/20 to-amber-500/10",
  purple: "from-violet-500/20 to-purple-500/10",
};

export function StatCard({
  label,
  value,
  context,
  icon,
  tone = "accent",
  trend,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-2/80 p-4 transition-all duration-200 hover:border-border-default hover:bg-surface-3/60 hover:shadow-card">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-500/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            {label}
          </p>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
            {value}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {context && (
              <div className="text-xs text-text-tertiary">{context}</div>
            )}
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.direction === "up"
                    ? "text-success-400"
                    : trend.direction === "down"
                      ? "text-error-400"
                      : "text-text-tertiary"
                }`}
              >
                {trend.direction === "up" && "↑ "}
                {trend.direction === "down" && "↓ "}
                {trend.value}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${ICON_BG[tone]} ${CHIP_CLASSES[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
