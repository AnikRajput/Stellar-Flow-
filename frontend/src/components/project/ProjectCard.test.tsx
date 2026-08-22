/**
 * ProjectCard tests — updated for new premium design.
 *
 * The card is role-aware: `client` shows the freelancer as counterpart + escrow
 * progress + next client action; `freelancer` shows the client as counterpart + the next milestone.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectCard } from "@/components/project/ProjectCard";
import { shortenAddress } from "@/utils/format";
import type { Milestone } from "@/types/milestone";
import type { Project } from "@/types/project";

const CLIENT = `G${"C".repeat(55)}`;
const FREELANCER = `G${"F".repeat(55)}`;

const project: Project = {
  id: 1,
  client: CLIENT,
  freelancer: FREELANCER,
  token: `C${"T".repeat(55)}`,
  totalAmount: "1000000000", // 100 XLM
  escrowBalance: "400000000", // 40 XLM — underfunded
  status: "active",
  milestoneCount: 1,
  createdAt: 0,
};

const milestones: Milestone[] = [
  {
    id: 1,
    name: "Homepage",
    amount: "400000000",
    status: "pending",
    dueDate: 2000000000,
  },
];

describe("ProjectCard", () => {
  it("renders the client view: freelancer counterpart, funding %, next client action", () => {
    render(<ProjectCard project={project} role="client" />);

    expect(screen.getByText("Freelancer")).toBeInTheDocument();
    expect(screen.getByText(shortenAddress(FREELANCER))).toBeInTheDocument();
    // No milestones passed → progress label is the escrow funding fallback.
    expect(screen.getByText("Escrow funded")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    // Underfunded escrow → the client's next step.
    expect(screen.getByText("Fund escrow")).toBeInTheDocument();
    expect(screen.getByText(/40 \/ 100 XLM/)).toBeInTheDocument();

    // Client view must not render the freelancer's next-milestone block.
    expect(screen.queryByText("Next milestone")).not.toBeInTheDocument();
    expect(screen.queryByText("Client")).not.toBeInTheDocument();
  });

  it("renders the freelancer view: client counterpart + next milestone", () => {
    render(
      <ProjectCard project={project} role="freelancer" milestones={milestones} />,
    );

    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText(shortenAddress(CLIENT))).toBeInTheDocument();

    // The freelancer's card shows the earliest pending/submitted milestone.
    expect(screen.getByText("Next milestone")).toBeInTheDocument();
    expect(screen.getByText("Homepage")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    // Client-only bits are absent for the freelancer view.
    expect(screen.queryByText("Escrow funded")).not.toBeInTheDocument();
    expect(screen.queryByText("Fund escrow")).not.toBeInTheDocument();
    expect(screen.getByText(/40 \/ 100 XLM/)).toBeInTheDocument();
  });
});
