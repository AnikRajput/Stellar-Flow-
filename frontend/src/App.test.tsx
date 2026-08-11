/**
 * App shell smoke tests (Phase: app shell wiring).
 *
 * Verifies the shell actually mounts and that state-driven navigation swaps
 * views when sidebar items are clicked — the wiring `main.tsx` + `App` are
 * responsible for. No mock of CONTRACTS: `frontend/.env` provides placeholder
 * contract IDs so `src/config/contracts.ts` can load; contract-backed features
 * (project grid, activity feed) render their honest loading/error states,
 * which is exactly what these tests assert.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App shell", () => {
  it("boots to the Dashboard with the full sidebar", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();

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

    await user.click(screen.getByRole("button", { name: "New project" }));
    // The wizard is gated behind WalletGuard — without a connected wallet it
    // shows the connect prompt (this is the honest, real behavior).
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });
});
