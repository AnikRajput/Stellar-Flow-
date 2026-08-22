import type { ReactNode } from "react";

/**
 * Semantic badge tones — premium, compact, modern.
 */
export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "gray"
  | "accent"
  | "purple";

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
    badge: "border-success-500/20 bg-success-500/10 text-success-400",
    dot: "bg-success-400",
  },
  amber: {
    badge: "border-warning-500/20 bg-warning-500/10 text-warning-400",
    dot: "bg-warning-400",
  },
  red: {
    badge: "border-error-500/20 bg-error-500/10 text-error-400",
    dot: "bg-error-400",
  },
  gray: {
    badge: "border-border-default bg-surface-3 text-text-secondary",
    dot: "bg-text-tertiary",
  },
  accent: {
    badge: "border-accent-500/20 bg-accent-500/10 text-accent-400",
    dot: "bg-accent-400",
  },
  purple: {
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-400",
    dot: "bg-violet-400",
  },
};

export function Badge({ tone, children, className = "", title }: BadgeProps) {
  const { badge, dot } = TONE_CLASSES[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none tracking-wide ${badge} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
