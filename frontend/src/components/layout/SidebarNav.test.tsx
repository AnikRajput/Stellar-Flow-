/**
 * SidebarNav responsive-frame tests — updated for new premium design.
 *
 * Desktop (≥768px): sidebar with all nav items.
 * Mobile (<768px): top bar + fixed bottom tab bar with main nav items only.
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

/** Main nav items that appear in the mobile bottom bar. */
const MOBILE_BOTTOM_ITEMS = [
  "Dashboard",
  "Projects",
  "Activity",
  "Disputes",
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
    // Bottom tab bar with main items.
    const bottomBar = document.querySelector("nav.fixed");
    expect(bottomBar).not.toBeNull();
    // Settings is NOT in the mobile bottom bar (it's in the sidebar bottom group)
    for (const item of MOBILE_BOTTOM_ITEMS) {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    }
    // The active item is flagged for assistive tech.
    expect(
      screen.getByRole("button", { name: "Activity" }),
    ).toHaveAttribute("aria-current", "page");
    // The mobile frame keeps its brand bar.
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
