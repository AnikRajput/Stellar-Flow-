import type { ReactNode } from "react";

/** Shared input styling with new premium colors. */
export const inputClass =
  "w-full rounded-lg border border-border-default bg-surface-2/80 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30";

interface FieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
  required,
  error,
}: FieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-text-secondary"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-accent-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {hint && (
          <span className="text-[11px] text-text-muted">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-error-300">
          {error}
        </p>
      )}
    </div>
  );
}
