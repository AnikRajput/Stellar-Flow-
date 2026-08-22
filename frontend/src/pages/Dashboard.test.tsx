/**
 * Dashboard tests — updated for new premium design.
 *
 * Mocks the data hooks (`useProjects`, `useContractEvents`) so the test drives
 * the loading → data transition deterministically.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/pages/Dashboard";
import type { Project } from "@/types/project";

const CLIENT = `G${"C".repeat(55)}`;
const FREELANCER = `G${"F".repeat(55)}`;

/** Module-level mutable state the mocked hooks read — tests flip it to drive UI. */
const state = vi.hoisted(() => ({
  projects: [] as Project[],
  loading: true,
  error: null as Error | null,
  refetch: vi.fn(),
}));

vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({
    projects: state.projects,
    loading: state.loading,
    error: state.error,
    refetch: state.refetch,
  }),
}));

vi.mock("@/hooks/useContractEvents", () => ({
  useContractEvents: () => ({ events: [], loading: false }),
}));

const projectFixture: Project = {
  id: 1,
  client: CLIENT,
  freelancer: FREELANCER,
  token: `C${"T".repeat(55)}`,
  totalAmount: "1000000000", // 100 XLM
  escrowBalance: "400000000", // 40 XLM
  status: "active",
  milestoneCount: 1,
  createdAt: 0,
};

beforeEach(() => {
  state.projects = [];
  state.loading = true;
  state.error = null;
  state.refetch.mockClear();
});

describe("Dashboard", () => {
  it("shows loading skeletons, then the project grid once useProjects resolves", () => {
    const { rerender } = render(<Dashboard />);

    // Loading: skeleton shimmer blocks visible, no project cards, no empty state.
    expect(screen.getByText("Your Projects")).toBeInTheDocument();
    // Shimmer skeletons use the `shimmer` class on child elements
    expect(document.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Project #1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No projects yet/)).not.toBeInTheDocument();

    // useProjects resolves → cards render, skeletons gone.
    state.loading = false;
    state.projects = [projectFixture];
    rerender(<Dashboard />);

    expect(screen.getByText("Project #1")).toBeInTheDocument();
  });

  it("renders the error state and retries via refetch", () => {
    state.loading = false;
    state.error = new Error("reads are stubbed this phase");

    const { rerender } = render(<Dashboard />);

    expect(screen.getByText("Couldn't load your projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.refetch).toHaveBeenCalledTimes(1);

    // Retry clears the error → empty state for the (still empty) list.
    state.error = null;
    rerender(<Dashboard />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });
});
