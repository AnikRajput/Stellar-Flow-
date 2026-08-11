/**
 * StepMilestones tests (Phase 14).
 *
 * The wizard gates submission on `validateMilestones().ok` — the Create
 * Project button is `disabled={!allValid}` where `allValid` includes
 * `milestones.ok` — so the exact-match rule is tested on both layers:
 *   - the validation gate returns `ok: false` when the sum ≠ total, and
 *   - the sticky TotalsBar shows the mismatch AMOUNT inline ("Short by X" /
 *     "Over by X"), never a bare "invalid".
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepMilestones } from "@/components/project/create/StepMilestones";
import {
  validateMilestones,
  type MilestoneDraft,
} from "@/components/project/create/wizard";

function draftRow(id: string, amount: string): MilestoneDraft {
  return { id, name: "Milestone", amount, dueDate: "2026-09-01" };
}

const noopProps = {
  onChangeTotal: vi.fn(),
  onUpdateMilestone: vi.fn(),
  onAddMilestone: vi.fn(),
  onRemoveMilestone: vi.fn(),
};

describe("StepMilestones", () => {
  it("blocks submit when the sum is short, and shows the shortfall amount", () => {
    const milestones = [draftRow("m1", "40"), draftRow("m2", "50")];
    const validation = validateMilestones(milestones, "100");

    // The submit gate (Create Project button's `disabled={!allValid}`).
    expect(validation.ok).toBe(false);

    render(
      <StepMilestones
        {...noopProps}
        milestones={milestones}
        totalAmount="100"
        validation={validation}
      />,
    );

    // Running total 9 vs project total 100 → short by 10 XLM, shown inline.
    expect(screen.getByText(/Running total/)).toBeInTheDocument();
    expect(screen.getByText(/Short by 10 XLM/)).toBeInTheDocument();
  });

  it("blocks submit when the sum exceeds the total, showing the excess", () => {
    const milestones = [draftRow("m1", "40"), draftRow("m2", "70")];
    const validation = validateMilestones(milestones, "100");

    expect(validation.ok).toBe(false);

    render(
      <StepMilestones
        {...noopProps}
        milestones={milestones}
        totalAmount="100"
        validation={validation}
      />,
    );

    expect(screen.getByText(/Over by 10 XLM/)).toBeInTheDocument();
  });

  it("allows submit on an exact match and says so", () => {
    const milestones = [draftRow("m1", "40"), draftRow("m2", "60")];
    const validation = validateMilestones(milestones, "100");

    expect(validation.ok).toBe(true);

    render(
      <StepMilestones
        {...noopProps}
        milestones={milestones}
        totalAmount="100"
        validation={validation}
      />,
    );

    expect(screen.getByText(/Matches the project total exactly/)).toBeInTheDocument();
  });
});
