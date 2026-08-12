/**
 * SidebarNav responsive-frame tests (Phase 15).
 *
 * The nav swaps between the desktop sidebar (≥768px) and a mobile top bar +
 * fixed bottom tab bar (<768px) based on `matchMedia`. jsdom has no
 * matchMedia, so these tests install a stub and flip `matches` to lock the
 * frame under test:
 *
 *   - matches=true  → desktop sidebar, no bottom tab bar
 *   - matches=false → bottom tab bar + top bar, no sidebar `<aside>`
 *
 * Asserting the bottom bar matters because it is otherwise never rendered in
 * jsdom (the hook falls back to the desktop frame when matchMedia is
 * missing), so a regression there would go unnoticed.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";

const NAV_ITEMS = [
  "Dashboard",
  "Projects",
  "Activity",
  "Disputes",
  "Settings",
] as const;

const originalMatchMedia = window.matchMedia;

/** Installs a matchMedia stub locked to one `matches` value. */
function stubMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  stubMatchMedia(true);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe("SidebarNav", () => {
  it("renders the desktop sidebar (and no bottom bar) at the desktop breakpoint", () => {
    stubMatchMedia(true);
    render(<SidebarNav active="dashboard" />);

    expect(document.querySelector("aside")).not.toBeNull();
    // All five nav buttons exist inside the sidebar.
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    }
    // The mobile frame (top bar + fixed bottom bar) is not rendered.
    expect(document.querySelector("header")).toBeNull();
    expect(
      document.querySelector("nav.fixed"),
    ).toBeNull();
  });

  it("renders the mobile top bar + bottom tab bar (and no sidebar) below the breakpoint", () => {
    stubMatchMedia(false);
    render(<SidebarNav active="activity" />);

    // No squeezed sidebar.
    expect(document.querySelector("aside")).toBeNull();
    // Bottom tab bar with all five items.
    const bottomBar = document.querySelector("nav.fixed");
    expect(bottomBar).not.toBeNull();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    }
    // The active item is flagged for assistive tech.
    expect(
      screen.getByRole("button", { name: "Activity" }),
    ).toHaveAttribute("aria-current", "page");
    // The mobile frame keeps its brand bar (brand text is split across
    // nested spans, so match the header's full text content).
    const topBar = document.querySelector("header");
    expect(topBar).not.toBeNull();
    expect(topBar).toHaveTextContent("StellarFlow");
  });

  it("forwards navigation clicks from the bottom tab bar", () => {
    stubMatchMedia(false);
    const onNavigate = vi.fn();
    render(<SidebarNav active="dashboard" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(onNavigate).toHaveBeenCalledWith("projects" satisfies NavItemId);
  });
});
