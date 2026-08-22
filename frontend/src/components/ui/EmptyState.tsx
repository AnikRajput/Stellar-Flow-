import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Icon or illustration. */
  icon?: ReactNode;
  /** Title text. */
  title: string;
  /** Description text. */
  description: string;
  /** Optional action button. */
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

/**
 * Beautiful empty state component — replaces large error boxes
 * with a polished, helpful prompt.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface-2/40 px-8 py-12 text-center animate-fade-in">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-gradient px-4 py-2 text-sm font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 active:scale-[0.98]"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}
