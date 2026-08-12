/**
 * Wizard step 3 — milestones.
 *
 * Repeatable rows (name, amount in XLM, due date) with add/remove, a project
 * total input, and a **sticky footer bar** that compares the running milestone
 * total against the project total live as the user types. The mismatch amount
 * is shown inline (never a bare "invalid") because the escrow contract itself
 * rejects milestone sums that exceed total_amount.
 */

import { Field, inputClass } from "@/components/ui/Field";
import type {
  MilestoneDraft,
  MilestonesValidation,
} from "@/components/project/create/wizard";
import { formatStroopsAsUnits, STROOPS_PER_UNIT, formatUnits } from "@/utils/format";

interface StepMilestonesProps {
  milestones: MilestoneDraft[];
  totalAmount: string;
  validation: MilestonesValidation;
  onChangeTotal: (value: string) => void;
  onUpdateMilestone: (
    id: string,
    patch: Partial<Omit<MilestoneDraft, "id">>,
  ) => void;
  onAddMilestone: () => void;
  onRemoveMilestone: (id: string) => void;
}

export function StepMilestones({
  milestones,
  totalAmount,
  validation,
  onChangeTotal,
  onUpdateMilestone,
  onAddMilestone,
  onRemoveMilestone,
}: StepMilestonesProps) {
  return (
    <>
      <div className="space-y-6">
        <Field
          label="Project total (XLM)"
          htmlFor="project-total"
          required
          hint={
            validation.totalOk
              ? undefined
              : totalAmount.trim()
                ? "Positive number, up to 7 decimals"
                : "Required"
          }
          error={
            totalAmount.trim() !== "" && !validation.totalOk
              ? "Enter a positive amount (up to 7 decimals)."
              : undefined
          }
        >
          <input
            id="project-total"
            type="text"
            inputMode="decimal"
            value={totalAmount}
            onChange={(event) => onChangeTotal(event.target.value)}
            placeholder="e.g. 2500"
            aria-invalid={
              totalAmount.trim() !== "" && !validation.totalOk
                ? true
                : undefined
            }
            className={`${inputClass} max-w-xs tabular-nums`}
          />
        </Field>

        <div className="space-y-4">
          {milestones.map((milestone, index) => {
            const errors = validation.rowErrors[milestone.id];
            return (
              <div
                key={milestone.id}
                className="rounded-xl border border-ink-800 bg-ink-900/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-200">
                    Milestone {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemoveMilestone(milestone.id)}
                    disabled={milestones.length <= 1}
                    title={
                      milestones.length <= 1
                        ? "Keep at least one milestone"
                        : "Remove this milestone"
                    }
                    className="rounded-md px-2 py-1 text-xs font-medium text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-400"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_8rem_11rem]">
                  <Field
                    label="Name"
                    htmlFor={`milestone-${milestone.id}-name`}
                    required
                    error={errors.name}
                  >
                    <input
                      id={`milestone-${milestone.id}-name`}
                      type="text"
                      value={milestone.name}
                      onChange={(event) =>
                        onUpdateMilestone(milestone.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="e.g. Homepage + navigation"
                      aria-invalid={errors.name ? true : undefined}
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Amount (XLM)"
                    htmlFor={`milestone-${milestone.id}-amount`}
                    required
                    error={errors.amount}
                  >
                    <input
                      id={`milestone-${milestone.id}-amount`}
                      type="text"
                      inputMode="decimal"
                      value={milestone.amount}
                      onChange={(event) =>
                        onUpdateMilestone(milestone.id, {
                          amount: event.target.value,
                        })
                      }
                      placeholder="e.g. 500"
                      aria-invalid={errors.amount ? true : undefined}
                      className={`${inputClass} tabular-nums`}
                    />
                  </Field>

                  <Field
                    label="Due date"
                    htmlFor={`milestone-${milestone.id}-due`}
                    required
                    error={errors.dueDate}
                  >
                    <input
                      id={`milestone-${milestone.id}-due`}
                      type="date"
                      value={milestone.dueDate}
                      onChange={(event) =>
                        onUpdateMilestone(milestone.id, {
                          dueDate: event.target.value,
                        })
                      }
                      aria-invalid={errors.dueDate ? true : undefined}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAddMilestone}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 py-2 text-sm font-medium text-ink-300 transition-colors hover:border-navy-500 hover:text-navy-200"
        >
          <PlusIcon className="h-4 w-4" />
          Add milestone
        </button>
      </div>

      {/* Sticky footer: live running total vs project total + inline mismatch. */}
      <TotalsBar validation={validation} />
    </>
  );
}

function TotalsBar({ validation }: { validation: MilestonesValidation }) {
  const running = formatStroopsAsUnits(validation.runningStroops.toString());
  const total = validation.totalOk
    ? formatStroopsAsUnits(validation.totalStroops.toString())
    : null;

  const mismatch = validation.mismatchStroops;
  const difference = mismatch < 0n ? -mismatch : mismatch;
  const differenceLabel = formatUnits(Number(difference) / STROOPS_PER_UNIT);

  let status:
    | { kind: "match"; text: string }
    | { kind: "short"; text: string }
    | { kind: "over"; text: string }
    | { kind: "unset"; text: string } = {
    kind: "unset",
    text: "Enter the project total to compare amounts",
  };

  if (validation.totalOk && mismatch === 0n) {
    status = { kind: "match", text: "Matches the project total exactly" };
  } else if (validation.totalOk && mismatch < 0n) {
    status = { kind: "short", text: `Short by ${differenceLabel} XLM` };
  } else if (validation.totalOk) {
    status = { kind: "over", text: `Over by ${differenceLabel} XLM` };
  }

  const statusClass = {
    match: "text-emerald-300",
    short: "text-amber-300",
    over: "text-red-300",
    unset: "text-ink-400",
  }[status.kind];

  // Phase 15: on phones the bar floats above the fixed bottom nav (which is
  // ~56px + safe-area tall) instead of being hidden underneath it.
  return (
    <footer
      aria-live="polite"
      className="sticky bottom-16 z-10 mt-6 rounded-2xl border border-ink-700 bg-ink-900/95 px-5 py-4 backdrop-blur md:bottom-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-ink-300">
          Running total{" "}
          <strong className="tabular-nums text-ink-50">{running}</strong>
          <span className="text-ink-500">
            {" "}
            / {total ?? "—"} XLM project total
          </span>
        </p>
        <p className="text-sm font-medium">
          <span className={statusClass}>{status.text}</span>
          {!validation.rowsOk && (
            <span className="ml-1 font-normal text-ink-400">
              · fix the row errors above
            </span>
          )}
        </p>
      </div>
    </footer>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
