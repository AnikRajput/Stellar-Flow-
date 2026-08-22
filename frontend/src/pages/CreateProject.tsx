/**
 * Create Project wizard (Phase 9 → Phase 11 wiring).
 *
 * Four steps: Basics → Parties → Milestones → Review. Next/Submit are disabled
 * until the current step validates; milestones must sum to the project total
 * EXACTLY (the escrow contract itself rejects sums that exceed total_amount).
 *
 * "Create Project" now runs the REAL transaction lifecycle (`useTransaction`):
 * build → simulate → sign (Freighter) → submit → poll, first for
 * `create_project`, then one `add_milestone` per milestone row (sequentially).
 * The TxStatusPanel shows each stage live, the tx hash becomes linkable the
 * moment each transaction is submitted, and failures surface in plain language
 * with a Try Again that re-runs only the failed step.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { StepBasics } from "@/components/project/create/StepBasics";
import { StepMilestones } from "@/components/project/create/StepMilestones";
import { StepParties } from "@/components/project/create/StepParties";
import { StepReview } from "@/components/project/create/StepReview";
import {
  createEmptyMilestone,
  createInitialDraft,
  isBasicsValid,
  validateMilestones,
  validateParties,
  type MilestoneDraft,
  type ProjectDraft,
} from "@/components/project/create/wizard";
import { TxStatusPanel } from "@/components/transaction/TxStatusPanel";
import { WalletGuard } from "@/components/wallet/WalletGuard";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACTS } from "@/config/contracts";
import { useTransaction } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { getEscrowContract } from "@/services/contracts";
import { buildTx, toScVal } from "@/services/transactions";
import {
  STROOPS_PER_UNIT,
  formatUnits,
  xlmToStroops,
} from "@/utils/format";

const STEPS = ["Basics", "Parties", "Milestones", "Review"] as const;

/** Flow state of the on-chain creation sequence. */
type CreateFlow = "idle" | "running" | "done" | "failed";

/** "YYYY-MM-DD" (input[type=date]) → unix seconds for the u64 due_date. */
function dueDateToEpochSeconds(dateStr: string): number {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

export function CreateProject() {
  const wallet = useWallet();
  const clientAddress = wallet.address;
  const tx = useTransaction();

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(() =>
    createInitialDraft(CONTRACTS.token),
  );
  const [submitting, setSubmitting] = useState(false);
  // Mirrors `submitting` for callbacks that would otherwise capture a stale
  // value (resetFlow must not hide the live panel while a run is in flight).
  const submittingRef = useRef(false);
  const [flow, setFlow] = useState<CreateFlow>("idle");
  /** Index into `createSteps` of the step currently running / that failed. */
  const [flowStep, setFlowStep] = useState(0);
  /** Decoded `create_project` retval (project id). */
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);
  /** Non-transaction flow failures (e.g. contract returned no project id). */
  const [flowError, setFlowError] = useState<string | null>(null);

  const basicsOk = isBasicsValid(draft.name);
  const parties = validateParties(draft.freelancer, clientAddress);
  const milestones = validateMilestones(draft.milestones, draft.totalAmount);
  const allValid = basicsOk && parties.ok && milestones.ok;

  const canProceed = [basicsOk, parties.ok, milestones.ok][stepIndex] ?? true;
  const isLastStep = stepIndex === STEPS.length - 1;

  /** Labels for each on-chain step of the sequence (create + milestones). */
  const createSteps = useMemo(() => {
    const steps: Array<{ label: string }> = [{ label: "Create project" }];
    for (const milestone of draft.milestones) {
      steps.push({
        label: `Add milestone: ${milestone.name.trim() || "Untitled"}`,
      });
    }
    return steps;
  }, [draft.milestones]);

  // Any draft change invalidates a previous on-chain run — reset the flow so
  // stale success/failure panels never show a form they no longer describe.
  const resetFlow = useCallback(() => {
    // Never hide the live panel (or reset progress) while a run is submitting.
    if (submittingRef.current) {
      return;
    }
    setFlow("idle");
    setFlowStep(0);
    setCreatedProjectId(null);
    setFlowError(null);
  }, []);

  const patchDraft = useCallback(
    (patch: Partial<ProjectDraft>) => {
      setDraft((current) => ({ ...current, ...patch }));
      resetFlow();
    },
    [resetFlow],
  );

  const updateMilestone = useCallback(
    (id: string, patch: Partial<Omit<MilestoneDraft, "id">>) => {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.map((milestone) =>
          milestone.id === id ? { ...milestone, ...patch } : milestone,
        ),
      }));
      resetFlow();
    },
    [resetFlow],
  );

  const addMilestone = useCallback(() => {
    setDraft((current) => ({
      ...current,
      milestones: [...current.milestones, createEmptyMilestone()],
    }));
    resetFlow();
  }, [resetFlow]);

  const removeMilestone = useCallback(
    (id: string) => {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.filter((milestone) => milestone.id !== id),
      }));
      resetFlow();
    },
    [resetFlow],
  );

  const goBack = useCallback(() => {
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }, []);

  /**
   * Runs the on-chain sequence from a step index.
   *
   *  - `start === 0`: create_project, then every milestone's add_milestone
   *  - `start >= 1` (Try Again after a milestone step failed): re-runs only
   *    that milestone's add_milestone onward (never re-creates the project)
   *
   * Each transaction goes through the full lifecycle inside `useTransaction`.
   */
  async function runFlowFrom(start: number): Promise<void> {
    if (!allValid || !clientAddress || submitting) {
      return;
    }
    setSubmitting(true);
    submittingRef.current = true;
    setFlow("running");
    setFlowError(null);

    try {
      let projectId = createdProjectId;

      if (start === 0) {
        setFlowStep(0);
        setCreatedProjectId(null);
        projectId = null;

        // escrow.create_project(client, freelancer, token, total_amount: i128)
        const created = await tx.execute(() =>
          buildTx({
            contract: getEscrowContract(),
            method: "create_project",
            args: [
              toScVal(clientAddress),
              toScVal(draft.freelancer.trim()),
              toScVal(draft.token),
              toScVal(xlmToStroops(draft.totalAmount)),
            ],
            source: clientAddress,
          }),
        );
        if (created.outcome !== "confirmed") {
          setFlow("failed");
          return;
        }
        projectId = typeof created.result === "number" ? created.result : null;
        setCreatedProjectId(projectId);
      }

      if (projectId === null) {
        // Create landed but no id came back (or a retry from a later step with
        // no recorded id) — nothing safe to retry automatically.
        setFlowError(
          "The project exists on-chain, but we couldn't read its id. Check the explorer link and add milestones from the project page once reads land.",
        );
        setFlow("failed");
        return;
      }

      // escrow.add_milestone(client, project_id: u32, name, amount: i128, due_date: u64)
      const firstMilestone = Math.max(start - 1, 0);
      for (let i = firstMilestone; i < draft.milestones.length; i++) {
        setFlowStep(i + 1);
        const milestone = draft.milestones[i];
        const added = await tx.execute(() =>
          buildTx({
            contract: getEscrowContract(),
            method: "add_milestone",
            args: [
              toScVal(clientAddress),
              nativeToScVal(projectId, { type: "u32" }),
              toScVal(milestone.name.trim()),
              toScVal(xlmToStroops(milestone.amount)),
              nativeToScVal(dueDateToEpochSeconds(milestone.dueDate), {
                type: "u64",
              }),
            ],
            source: clientAddress,
          }),
        );
        if (added.outcome !== "confirmed") {
          setFlow("failed");
          return;
        }
      }

      setFlow("done");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <WalletGuard>
      {/* pb-24 clears the fixed mobile bottom nav (Phase 15). */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-24 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Create Project
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Define the scope, hire a freelancer, and escrow milestone
              payments.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        <Stepper current={stepIndex} />

        <div className="mt-8 rounded-xl border border-border-subtle bg-surface-2/60 p-6">
          {stepIndex === 0 && (
            <StepBasics
              name={draft.name}
              description={draft.description}
              onChange={patchDraft}
            />
          )}
          {stepIndex === 1 && (
            <StepParties
              freelancer={draft.freelancer}
              token={draft.token}
              onChange={patchDraft}
              clientAddress={clientAddress}
              validation={parties}
            />
          )}
          {stepIndex === 2 && (
            <StepMilestones
              milestones={draft.milestones}
              totalAmount={draft.totalAmount}
              validation={milestones}
              onChangeTotal={(value) => patchDraft({ totalAmount: value })}
              onUpdateMilestone={updateMilestone}
              onAddMilestone={addMilestone}
              onRemoveMilestone={removeMilestone}
            />
          )}
          {stepIndex === 3 && (
            <StepReview
              draft={draft}
              clientAddress={clientAddress}
              validation={milestones}
            />
          )}
        </div>

        {stepIndex === 3 && !milestones.ok && (
          <p className="mt-6 text-sm text-amber-300">
            {milestones.totalOk && milestones.mismatchStroops !== 0n ? (
              <>
                Milestones are{" "}
                {milestones.mismatchStroops < 0n ? "short" : "over"} by{" "}
                {formatMismatch(
                  milestones.mismatchStroops < 0n
                    ? -milestones.mismatchStroops
                    : milestones.mismatchStroops,
                )}{" "}
                XLM — they must match the project total exactly.
              </>
            ) : (
              "Fix the highlighted errors — milestone amounts must match the project total exactly."
            )}
          </p>
        )}

        {flow !== "idle" && (
          <div className="mt-6 space-y-3">
            {flow === "running" && (
              <p className="text-[11px] text-text-tertiary">
                Step {Math.min(flowStep + 1, createSteps.length)} of{" "}
                {createSteps.length} — {createSteps[flowStep]?.label}
              </p>
            )}
            <TxStatusPanel
              state={tx.state}
              hash={tx.hash}
              error={tx.error}
              onRetry={
                flow === "failed" && !flowError
                  ? () => void runFlowFrom(flowStep)
                  : undefined
              }
            />
            {flow === "failed" && tx.hash && (
              <p className="text-[11px] leading-relaxed text-text-tertiary">
                If the previous attempt actually landed on-chain, retrying may
                create a duplicate — check the explorer link above first.
              </p>
            )}
            {flow === "failed" && flowError && (
              <p
                role="alert"                  className="rounded-xl border border-error-500/20 bg-error-500/5 p-3 text-[11px] leading-relaxed text-error-300"
              >
                {flowError}
              </p>
            )}
            {flow === "done" && createdProjectId !== null && (
              <div
                role="status"
                className="rounded-xl border border-success-500/20 bg-success-500/5 p-5"
              >
                <p className="text-sm font-semibold text-success-300">
                  Project created on-chain
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                  Project #{createdProjectId} with {draft.milestones.length}{" "}
                  milestone
                  {draft.milestones.length === 1 ? "" : "s"} — confirmation
                  above. Funding the escrow is the next step.
                </p>
              </div>
            )}
          </div>
        )}

        <nav className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="min-h-11 rounded-lg border border-border-default bg-surface-3 px-4 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0"
          >
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={() => void runFlowFrom(0)}
              disabled={!allValid || submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-gradient px-5 py-2 text-[13px] font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none md:min-h-0"
            >
              {submitting && <SpinnerIcon />}
              {submitting ? "Creating…" : "Create Project"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed || submitting}
              className="min-h-11 rounded-lg bg-accent-gradient px-5 py-2 text-[13px] font-medium text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none md:min-h-0"
            >
              Next
            </button>
          )}
        </nav>
      </div>
    </WalletGuard>
  );
}

/** Format a stroop difference as an XLM number (used in the inline mismatch). */
function formatMismatch(stroops: bigint): string {
  return formatUnits(Number(stroops) / STROOPS_PER_UNIT);
}

function Stepper({ current }: { current: number }) {
  return (
    <ol
      className="mt-8 flex items-center gap-2 text-sm"
      aria-label="Wizard progress"
    >
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-success-500/15 text-success-400"
                  : active
                    ? "bg-accent-gradient text-white"
                    : "bg-surface-3 text-text-muted"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : index + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium text-text-primary"
                  : done
                    ? "text-text-secondary"
                    : "text-text-muted"
              }
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                className={`mx-1 h-px w-5 sm:w-8 ${
                  done ? "bg-success-500/40" : "bg-surface-4"
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
