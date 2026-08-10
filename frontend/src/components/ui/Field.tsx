import type { ReactNode } from "react";

/** Shared input styling so every wizard/forms input looks identical. */
export const inputClass =
  "w-full rounded-lg border border-ink-700 bg-ink-800/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/40";

interface FieldProps {
  label: string;
  /** `id` of the control this label describes. */
  htmlFor: string;
  children: ReactNode;
  /** Subtle right-aligned helper (e.g. "Optional"). */
  hint?: string;
  /** Marks the label with the accent asterisk. */
  required?: boolean;
  /** Inline validation message (announced via role="alert"). */
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
          className="text-sm font-medium text-ink-200"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-accent-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs leading-relaxed text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
