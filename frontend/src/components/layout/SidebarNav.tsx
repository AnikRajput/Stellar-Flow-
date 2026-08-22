/**
 * SidebarNav — redesigned for premium SaaS look.
 *
 * Desktop (≥768px): compact 240px sidebar with grouped nav,
 * gradient active indicator, wallet section at bottom.
 *
 * Mobile (<768px): fixed bottom tab bar with compact icons.
 */

import { useEffect, useState, type SVGProps } from "react";
import { EXPECTED_NETWORK_LABEL } from "@/hooks/useWallet";

export type NavItemId =
  | "dashboard"
  | "projects"
  | "activity"
  | "disputes"
  | "settings";

interface SidebarNavProps {
  /** Currently active section. */
  active: NavItemId;
  /** Optional click handler. */
  onNavigate?: (id: NavItemId) => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: NavItemId;
  label: string;
  group: "main" | "bottom";
}> = [
  { id: "dashboard", label: "Dashboard", group: "main" },
  { id: "projects", label: "Projects", group: "main" },
  { id: "activity", label: "Activity", group: "main" },
  { id: "disputes", label: "Disputes", group: "main" },
  { id: "settings", label: "Settings", group: "bottom" },
];

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return true;
    }
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

export function SidebarNav({ active, onNavigate }: SidebarNavProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border-subtle bg-surface-1/80 backdrop-blur-xl md:flex">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow-sm">
            <BrandMark />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-text-primary">
            Stellar<span className="text-accent-400">Flow</span>
          </span>
        </div>

        {/* Main navigation */}
        <nav className="mt-2 flex-1 px-3" aria-label="Primary">
          <div className="space-y-0.5">
            {NAV_ITEMS.filter((item) => item.group === "main").map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-accent-500/10 text-accent-300"
                      : "text-text-secondary hover:bg-surface-3/60 hover:text-text-primary"
                  }`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-gradient" />
                  )}
                  <NavIcon
                    id={item.id}
                    className={`h-[18px] w-[18px] ${
                      isActive
                        ? "text-accent-400"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    }`}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-border-subtle" />

          {/* Bottom navigation */}
          <div className="space-y-0.5">
            {NAV_ITEMS.filter((item) => item.group === "bottom").map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-accent-500/10 text-accent-300"
                      : "text-text-secondary hover:bg-surface-3/60 hover:text-text-primary"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-gradient" />
                  )}
                  <NavIcon
                    id={item.id}
                    className={`h-[18px] w-[18px] ${
                      isActive
                        ? "text-accent-400"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    }`}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Network pill + footer */}
        <div className="border-t border-border-subtle px-4 py-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-3/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
            <span
              className="h-1.5 w-1.5 rounded-full bg-success-400"
              aria-hidden="true"
            />
            {EXPECTED_NETWORK_LABEL}
          </span>
        </div>
      </aside>
    );
  }

  // Mobile: sticky brand bar + fixed bottom tab bar
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-1/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow-sm">
            <BrandMark />
          </span>
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Stellar<span className="text-accent-400">Flow</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-3/60 px-2 py-1 text-[10px] font-medium text-text-secondary">
          <span
            className="h-1.5 w-1.5 rounded-full bg-success-400"
            aria-hidden="true"
          />
          {EXPECTED_NETWORK_LABEL}
        </span>
      </header>

      {/* Fixed bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.filter((item) => item.group === "main").map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-accent-400" : "text-text-tertiary"
                }`}
              >
                <NavIcon
                  id={item.id}
                  className={`h-5 w-5 ${isActive ? "text-accent-400" : "text-text-tertiary"}`}
                />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function NavIcon({
  id,
  className,
}: {
  id: NavItemId;
  className?: string;
}) {
  const shared: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (id) {
    case "dashboard":
      return (
        <svg {...shared} className={className}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...shared} className={className}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M3 12h6" />
        </svg>
      );
    case "activity":
      return (
        <svg {...shared} className={className}>
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      );
    case "disputes":
      return (
        <svg {...shared} className={className}>
          <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared} className={className}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
  }
}

function BrandMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 6.2L21 9l-5 4.1 1.7 6.9L12 16.5 6.3 20l1.7-6.9L3 9l6.6-.8Z" />
    </svg>
  );
}
