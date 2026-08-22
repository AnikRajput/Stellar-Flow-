interface SkeletonProps {
  /** Sizing + shape classes (e.g. "h-4 w-24 rounded-md"). */
  className?: string;
}

/**
 * Premium loading skeleton with shimmer animation.
 * Callers own size and rounding via `className`.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-lg bg-surface-3 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite_linear] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}
