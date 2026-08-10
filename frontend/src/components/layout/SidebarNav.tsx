import type { SVGProps } from "react";
import { EXPECTED_NETWORK_LABEL } from "@/hooks/useWallet";

export type NavItemId =
  | "dashboard"
  | "projects"
  | "activity"
  | "disputes"
  | "settings";

interface SidebarNavProps {
  /** Currently active section. Router wiring lands with the app shell. */
  active: NavItemId;
  /** Optional click handler — replaced by real routing in a later phase. */
  onNavigate?: (id: NavItemId) => void;
}

const NAV_ITEMS: ReadonlyArray<{ id: NavItemId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "activity", label: "Activity" },
  { id: "disputes", label: "Disputes" },
  { id: "settings", label: "Settings" },
];

export function SidebarNav({ active, onNavigate }: SidebarNavProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/70 px-4 py-6 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/15 text-accent-300">
          <BrandMark />
        </span>
        <span className="text-base font-semibold tracking-tight text-ink-50">
          Stellar<span className="text-accent-400">Flow</span>
        </span>
      </div>

      <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-navy-600/20 text-ink-50"
                  : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-100"
              }`}
            >
              <NavIcon
                id={item.id}
                className={
                  isActive
                    ? "text-navy-300"
                    : "text-ink-500 group-hover:text-ink-300"
                }
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800/60 px-2.5 py-1 text-xs font-medium text-ink-300">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
          {EXPECTED_NETWORK_LABEL}
        </span>
      </div>
    </aside>
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
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (id) {
    case "dashboard":
      return (
        <svg {...shared} className={`h-4 w-4 ${className ?? ""}`}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...shared} className={`h-4 w-4 ${className ?? ""}`}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M3 12h6" />
        </svg>
      );
    case "activity":
      return (
        <svg {...shared} className={`h-4 w-4 ${className ?? ""}`}>
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      );
    case "disputes":
      return (
        <svg {...shared} className={`h-4 w-4 ${className ?? ""}`}>
          <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared} className={`h-4 w-4 ${className ?? ""}`}>
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
