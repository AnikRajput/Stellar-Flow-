/**
 * MilestoneTimeline tests (Phase 14).
 *
 * Asserts the node visuals for each flow state — paid / submitted / locked
 * (Pending + Approved share the locked category) / disputed — via the
 * semantic dot classes, and that the connector fill tracks the real paid
 * value (exact stroops), not a count.
 *
 * The wallet is mocked to an address that is neither party, so no action
 * buttons render and nothing touches the transaction service.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MilestoneTimeline } from "@/components/milestone/MilestoneTimeline";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";

const CLIENT = `G${"C".repeat(55)}`;
const FREELANCER = `G${"F".repeat(55)}`;
const VIEWER = `G${"V".repeat(55)}`;

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: VIEWER, // neither party → read-only timeline
    status: "connected",
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
  }),
}));

const project: Project = {
  id: 1,
  client: CLIENT,
  freelancer: FREELANCER,
  token: `C${"T".repeat(55)}`,
  totalAmount: "1000000000", // 100 XLM
  escrowBalance: "1000000000",
  status: "active",
  milestoneCount: 4,
  createdAt: 0,
};

/** One milestone per flow state; only the paid one contributes to the fill. */
const milestones: Milestone[] = [
  { id: 1, name: "Paid milestone", amount: "250000000", status: "paid", dueDate: 2000000000 },
  { id: 2, name: "Submitted milestone", amount: "250000000", status: "submitted", dueDate: 2000000000 },
  { id: 3, name: "Approved (locked)", amount: "250000000", status: "approved", dueDate: 2000000000 },
  { id: 4, name: "Disputed milestone", amount: "250000000", status: "disputed", dueDate: 2000000000 },
];

/** Per-state expected dot tint (NODE_DOT_CLASSES in MilestoneTimeline). */
const EXPECTED_DOT_TINT: Record<Milestone["status"], string> = {
  paid: "border-emerald-500/50",
  submitted: "border-amber-500/50",
  approved: "border-navy-500/50", // locked
  pending: "border-navy-500/50", // locked
  disputed: "border-red-500/50",
  cancelled: "border-ink-600",
};

describe("MilestoneTimeline", () => {
  it("renders one node per milestone with the correct state visual", () => {
    const { container } = render(
      <MilestoneTimeline project={project} milestones={milestones} />,
    );

    // One <li> per milestone (the connector is not an li).
    const nodes = Array.from(container.querySelectorAll("li"));
    expect(nodes).toHaveLength(4);

    nodes.forEach((node, index) => {
      const dot = node.firstElementChild;
      expect(dot).not.toBeNull();
      expect(dot!.className).toContain(EXPECTED_DOT_TINT[milestones[index].status]);
    });
  });

  it("fills the connector proportionally to the paid value (exact stroops)", () => {
    const { container } = render(
      <MilestoneTimeline project={project} milestones={milestones} />,
    );

    // 1 of 4 milestones paid at 25 XLM each → 25% of a 100 XLM project.
    const fill = container.querySelector('[class*="bg-emerald-500/80"]');
    expect(fill).not.toBeNull();
    expect((fill as HTMLElement).style.height).toBe("25%");
  });
});
