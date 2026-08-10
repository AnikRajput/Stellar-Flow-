import type { ReactNode } from "react";

/** Icon-chip tones — matches the semantic set plus the two brand tones. */
export type StatTone = "navy" | "accent" | "green" | "amber" | "red" | "gray";

interface StatCardProps {
  /** Short label above the value (e.g. "Active Projects"). */
  label: string;
  /** Formatted value — pass a `Skeleton` here while data is loading. */
  value: ReactNode;
  /** Optional context line under the value (e.g. "2 awaiting approval"). */
  context?: ReactNode;
  /** Optional icon rendered in a tinted chip. */
  icon?: ReactNode;
  /** Icon-chip tone. Defaults to `navy`. */
  tone?: StatTone;
}

const CHIP_CLASSES: Record<StatTone, string> = {
  navy: "bg-navy-600/15 text-navy-300",
  accent: "bg-accent-500/15 text-accent-300",
  green: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
  gray: "bg-ink-700/40 text-ink-300",
};

export function StatCard({
  label,
  value,
  context,
  icon,
  tone = "navy",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 transition-colors hover:border-ink-700">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </p>
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CHIP_CLASSES[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-ink-50">
        {value}
      </div>
      {context && (
        <div className="mt-1.5 text-xs leading-relaxed text-ink-400">
          {context}
        </div>
      )}
    </div>
  );
}
