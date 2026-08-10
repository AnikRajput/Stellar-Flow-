/**
 * Wizard step 4 — review.
 *
 * Read-only summary of the whole draft before submit: project details, parties,
 * budget (with the exact-match status), and the milestone breakdown.
 */

import { Badge } from "@/components/ui/Badge";
import type {
  MilestonesValidation,
  ProjectDraft,
} from "@/components/project/create/wizard";
import { formatDueDate } from "@/components/project/create/wizard";
import {
  formatStroopsAsUnits,
  STROOPS_PER_UNIT,
  formatUnits,
  shortenAddress,
  xlmToStroops,
} from "@/utils/format";

interface StepReviewProps {
  draft: ProjectDraft;
  /** Connected wallet address — the project's client. */
  clientAddress: string | null;
  validation: MilestonesValidation;
}

export function StepReview({
  draft,
  clientAddress,
  validation,
}: StepReviewProps) {
  const total = validation.totalOk
    ? formatStroopsAsUnits(validation.totalStroops.toString())
    : "—";
  const running = formatStroopsAsUnits(validation.runningStroops.toString());

  const mismatch = validation.mismatchStroops;
  const difference = mismatch < 0n ? -mismatch : mismatch;
  const differenceLabel = formatUnits(Number(difference) / STROOPS_PER_UNIT);

  let budgetTone: "green" | "amber" | "red" | "gray" = "gray";
  let budgetText = "Total not set";
  if (validation.totalOk && mismatch === 0n) {
    budgetTone = "green";
    budgetText = "Exact match";
  } else if (validation.totalOk && mismatch < 0n) {
    budgetTone = "amber";
    budgetText = `Short by ${differenceLabel} XLM`;
  } else if (validation.totalOk) {
    budgetTone = "red";
    budgetText = `Over by ${differenceLabel} XLM`;
  }

  return (
    <div className="space-y-6">
      <section aria-label="Project details">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Project
        </h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Name</dt>
            <dd className="text-right font-medium text-ink-100">
              {draft.name.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Description</dt>
            <dd className="max-w-[60%] text-right text-ink-200">
              {draft.description.trim() || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Parties">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Parties
        </h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Client (you)</dt>
            <dd className="font-mono text-ink-100">
              {clientAddress ? shortenAddress(clientAddress) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Freelancer</dt>
            <dd className="font-mono text-ink-100">
              {shortenAddress(draft.freelancer)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Token</dt>
            <dd className="font-mono text-ink-100">
              {shortenAddress(draft.token)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Budget">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Budget
          </h3>
          <Badge tone={budgetTone}>{budgetText}</Badge>
        </div>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Milestones total</dt>
            <dd className="tabular-nums text-ink-100">{running} XLM</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Project total</dt>
            <dd className="tabular-nums text-ink-100">{total} XLM</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Milestones">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Milestones ({draft.milestones.length})
        </h3>
        <ul className="mt-2 divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900/60">
          {draft.milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-100">
                  {index + 1}. {milestone.name.trim() || "Untitled milestone"}
                </p>
                <p className="text-xs text-ink-400">
                  Due {milestone.dueDate ? formatDueDate(milestone.dueDate) : "—"}
                </p>
              </div>
              <p className="shrink-0 tabular-nums text-ink-100">
                {formatStroopsAsUnits(xlmToStroops(milestone.amount).toString())} XLM
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
