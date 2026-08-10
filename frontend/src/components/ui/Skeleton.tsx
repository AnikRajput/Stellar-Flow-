interface SkeletonProps {
  /** Sizing + shape classes (e.g. "h-4 w-24 rounded-md"). */
  className?: string;
}

/**
 * Neutral loading placeholder (animated pulse). Callers own size and rounding
 * via `className`, so composites can match the shape they are replacing.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-ink-800 ${className}`}
    />
  );
}
