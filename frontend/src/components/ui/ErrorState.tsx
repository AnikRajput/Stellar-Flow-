import type { ReactNode } from "react";

interface ErrorStateProps {
  /** Error title. */
  title?: string;
  /** Error message. */
  message: string;
  /** Retry handler. */
  onRetry?: () => void;
  /** Optional technical details. */
  details?: string;
  /** Optional icon override. */
  icon?: ReactNode;
}

/**
 * Compact inline error component — does not dominate the page.
 * Shows a subtle warning with a retry button.
 */
export function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
  details,
  icon,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="animate-fade-in rounded-xl border border-error-500/20 bg-error-500/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-400">
          {icon || (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-error-300">{title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{message}</p>
          {details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary">
                Technical details
              </summary>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-3 p-2 text-[11px] text-text-secondary">
                {details}
              </pre>
            </details>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:border-border-strong hover:bg-surface-4 hover:text-text-primary"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
