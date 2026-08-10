import type { ReactNode } from "react";

/**
 * Semantic badge tones. Status values map to the green/amber/red/gray set —
 * never the brand accent (reserved for primary actions).
 */
export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "gray"
  | "navy"
  | "accent";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  /** Extra layout classes (e.g. spacing in a flex row). */
  className?: string;
  /** Tooltip / accessible label override. */
  title?: string;
}

const TONE_CLASSES: Record<BadgeTone, { badge: string; dot: string }> = {
  green: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  amber: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  red: {
    badge: "border-red-500/30 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
  gray: {
    badge: "border-ink-700 bg-ink-800 text-ink-300",
    dot: "bg-ink-400",
  },
  navy: {
    badge: "border-navy-500/30 bg-navy-500/10 text-navy-300",
    dot: "bg-navy-400",
  },
  accent: {
    badge: "border-accent-500/30 bg-accent-500/10 text-accent-300",
    dot: "bg-accent-400",
  },
};

export function Badge({ tone, children, className = "", title }: BadgeProps) {
  const { badge, dot } = TONE_CLASSES[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${badge} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
