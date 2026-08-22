/**
 * App shell smoke tests — updated for new premium design.
 *
 * Verifies the shell actually mounts and that state-driven navigation swaps
 * views when sidebar items are clicked.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App shell", () => {
  it("boots to the Dashboard with the full sidebar", async () => {
    render(<App />);

    // Dashboard shows a greeting heading (time-based) instead of plain "Dashboard"
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.length).toBeGreaterThan(0);

    for (const item of [
      "Dashboard",
      "Projects",
      "Activity",
      "Disputes",
      "Settings",
    ]) {
      expect(
        screen.getByRole("button", { name: item }),
      ).toBeInTheDocument();
    }
  });

  it("navigates to Activity, Settings, and Disputes via the sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Activity" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Activity" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    // Settings shows real config — the RPC endpoint is rendered read-only.
    expect(screen.getByText(/RPC endpoint/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disputes" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Disputes" }),
    ).toBeInTheDocument();
  });

  it("opens the Create Project wizard from the Projects view", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Projects" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();

    // Button text changed from "New project" to "New Project"
    await user.click(screen.getByRole("button", { name: "New Project" }));
    // The wizard is gated behind WalletGuard — without a connected wallet it
    // shows the connect prompt (this is the honest, real behavior).
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });
});
