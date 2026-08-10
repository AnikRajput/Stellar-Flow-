/**
 * Create Project wizard (Phase 9).
 *
 * Four steps: Basics → Parties → Milestones → Review. Next/Submit are disabled
 * until the current step validates; milestones must sum to the project total
 * EXACTLY (the escrow contract itself rejects sums that exceed total_amount).
 *
 * Submit runs a real build+simulation of `escrow.create_project` through
 * `useContract` — no signing, no fake success. The simulation response is
 * surfaced verbatim (accepted → would create project #N; contract error → shown
 * as-is). `add_milestone` calls happen after real creation in Phase 11.
 */

import { useCallback, useState } from "react";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
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
import { WalletGuard } from "@/components/wallet/WalletGuard";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACTS } from "@/config/contracts";
import { useContract } from "@/hooks/useContract";
import { useWallet } from "@/hooks/useWallet";
import {
  STROOPS_PER_UNIT,
  formatUnits,
  xlmToStroops,
} from "@/utils/format";

const STEPS = ["Basics", "Parties", "Milestones", "Review"] as const;

interface SimulationOutcome {
  ok: boolean;
  title: string;
  detail: string;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Narrow the raw simulation response (returned as `unknown` by useContract)
 * into a human-readable outcome. Uses the documented rpc.Api response shape:
 * success carries `.result.retval`, failure carries `.error`.
 */
function describeSimulation(result: unknown): SimulationOutcome {
  if (result === null || typeof result !== "object") {
    return {
      ok: false,
      title: "Unexpected response",
      detail: "The RPC returned an unrecognized simulation result.",
    };
  }
  const sim = result as {
    error?: unknown;
    result?: { retval?: unknown };
  };
  if (sim.error) {
    return {
      ok: false,
      title: "Contract rejected the project",
      detail: `Simulation error: ${String(sim.error)}`,
    };
  }
  if (sim.result) {
    const retval = sim.result.retval;
    if (retval) {
      try {
        // create_project returns the new project id (u32 → number).
        const projectId = scValToNative(retval as xdr.ScVal);
        if (projectId !== null && projectId !== undefined) {
          return {
            ok: true,
            title: "Validation succeeded",
            detail: `The escrow contract accepted the project and would create it with id #${String(projectId)}. Signing and submission land in Phase 11.`,
          };
        }
      } catch {
        // retval present but not decodable — the simulation itself succeeded.
      }
    }
    return {
      ok: true,
      title: "Validation succeeded",
      detail:
        "The escrow contract accepted the transaction in simulation. Signing and submission land in Phase 11.",
    };
  }
  return {
    ok: false,
    title: "Inconclusive simulation",
    detail: "The RPC returned neither a result nor an error.",
  };
}

export function CreateProject() {
  const wallet = useWallet();
  const { call } = useContract();
  const clientAddress = wallet.address;

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(() =>
    createInitialDraft(CONTRACTS.token),
  );
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);

  const basicsOk = isBasicsValid(draft.name);
  const parties = validateParties(draft.freelancer, clientAddress);
  const milestones = validateMilestones(draft.milestones, draft.totalAmount);
  const allValid = basicsOk && parties.ok && milestones.ok;

  const canProceed = [basicsOk, parties.ok, milestones.ok][stepIndex] ?? true;
  const isLastStep = stepIndex === STEPS.length - 1;

  // Any draft change invalidates a previous simulation outcome — clear it in
  // every mutation handler so the success/error panel always matches the form.
  const patchDraft = useCallback((patch: Partial<ProjectDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setOutcome(null);
  }, []);

  const updateMilestone = useCallback(
    (id: string, patch: Partial<Omit<MilestoneDraft, "id">>) => {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.map((milestone) =>
          milestone.id === id ? { ...milestone, ...patch } : milestone,
        ),
      }));
      setOutcome(null);
    },
    [],
  );

  const addMilestone = useCallback(() => {
    setDraft((current) => ({
      ...current,
      milestones: [...current.milestones, createEmptyMilestone()],
    }));
    setOutcome(null);
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setDraft((current) => ({
      ...current,
      milestones: current.milestones.filter((milestone) => milestone.id !== id),
    }));
    setOutcome(null);
  }, []);

  const goBack = useCallback(() => {
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }, []);

  async function handleSubmit(): Promise<void> {
    if (!allValid || !clientAddress || submitting) {
      return;
    }
    setSubmitting(true);
    setOutcome(null);
    try {
      // escrow.create_project(client, freelancer, token, total_amount: i128)
      // Real signing + submission (and the follow-up add_milestone calls for
      // each milestone row) land in Phase 11.
      const result = await call(CONTRACTS.escrow, "create_project", [
        clientAddress,
        draft.freelancer.trim(),
        draft.token,
        xlmToStroops(draft.totalAmount),
      ]);
      setOutcome(describeSimulation(result));
    } catch (err) {
      setOutcome({
        ok: false,
        title: "Couldn't validate on-chain",
        detail: toErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WalletGuard>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Create Project
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Define the scope, hire a freelancer, and escrow milestone
              payments.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        <Stepper current={stepIndex} />

        <div className="mt-8 rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
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

        {outcome && (
          <div
            role="status"
            className={`mt-6 rounded-2xl border p-5 ${
              outcome.ok
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                outcome.ok ? "text-emerald-200" : "text-red-200"
              }`}
            >
              {outcome.ok ? "✓" : "✕"} {outcome.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              {outcome.detail}
            </p>
          </div>
        )}

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

        <nav className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!allValid || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-navy-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting && <SpinnerIcon />}
              {submitting ? "Validating…" : "Create Project"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-navy-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
                  ? "bg-emerald-500/20 text-emerald-300"
                  : active
                    ? "bg-navy-600 text-white"
                    : "bg-ink-800 text-ink-400"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : index + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium text-ink-100"
                  : done
                    ? "text-ink-300"
                    : "text-ink-500"
              }
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                className={`mx-1 h-px w-5 sm:w-8 ${
                  done ? "bg-emerald-500/40" : "bg-ink-700"
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
