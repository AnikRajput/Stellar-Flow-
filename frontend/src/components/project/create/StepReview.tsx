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
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Project
        </h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Name</dt>
            <dd className="text-right font-medium text-text-primary">
              {draft.name.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Description</dt>
            <dd className="max-w-[60%] text-right text-text-secondary">
              {draft.description.trim() || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Parties">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Parties
        </h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Client (you)</dt>
            <dd className="font-mono text-text-secondary">
              {clientAddress ? shortenAddress(clientAddress) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Freelancer</dt>
            <dd className="font-mono text-text-secondary">
              {shortenAddress(draft.freelancer)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Token</dt>
            <dd className="font-mono text-text-secondary">
              {shortenAddress(draft.token)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Budget">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Budget
          </h3>
          <Badge tone={budgetTone}>{budgetText}</Badge>
        </div>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Milestones total</dt>
            <dd className="tabular-nums text-text-secondary">{running} XLM</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Project total</dt>
            <dd className="tabular-nums text-text-secondary">{total} XLM</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Milestones">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Milestones ({draft.milestones.length})
        </h3>
        <ul className="mt-2 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-2/60">
          {draft.milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">
                  {index + 1}. {milestone.name.trim() || "Untitled milestone"}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  Due {milestone.dueDate ? formatDueDate(milestone.dueDate) : "—"}
                </p>
              </div>
              <p className="shrink-0 tabular-nums text-text-secondary">
                {formatStroopsAsUnits(xlmToStroops(milestone.amount).toString())} XLM
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
