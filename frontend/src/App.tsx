/**
 * StellarFlow app shell (routing wiring promised by earlier phases).
 *
 * No router is installed — navigation is state-driven, consistent with how the
 * pages themselves already switch tabs. The shell owns one piece of state:
 * which view is active. Each page keeps its own `SidebarNav` and receives an
 * `onNavigate` callback so the nav works app-wide.
 *
 * Views:
 *  - dashboard / activity / create / project → the real pages built so far
 *  - projects → a real listing (reuses `useProjects` + `ProjectCard`)
 *  - disputes → real dispute listing (Phase 13 — events + real reads)
 *  - settings → real read-only network config from `frontend/.env`
 *
 * No fake data: the projects grid shows skeletons while loading and an honest
 * error state otherwise (project reads are still stubbed this phase).
 */

import { useCallback, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { ProjectCard, ProjectCardSkeleton } from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACTS, NETWORK, RPC_URL } from "@/config/contracts";
import { useProjects } from "@/hooks/useProjects";
import { useWallet } from "@/hooks/useWallet";
import { EXPECTED_NETWORK_LABEL } from "@/hooks/useWallet";
import { Activity } from "@/pages/Activity";
import { CreateProject } from "@/pages/CreateProject";
import { Dashboard } from "@/pages/Dashboard";
import { Disputes } from "@/pages/Disputes";
import { ProjectDetails } from "@/pages/ProjectDetails";
import { shortenAddress } from "@/utils/format";

/** The full set of shell views. Nav items map 1:1 to a simple view. */
type View =
  | { name: NavItemId }
  | { name: "create" }
  | { name: "project"; projectId: number };

export function App() {
  const [view, setView] = useState<View>({ name: "dashboard" });

  const navigate = useCallback((id: NavItemId) => {
    setView({ name: id });
  }, []);

  const openProject = useCallback((projectId: number) => {
    setView({ name: "project", projectId });
  }, []);

  const goCreate = useCallback(() => setView({ name: "create" }), []);

  switch (view.name) {
    case "dashboard":
      return (
        <Dashboard
          onNavigate={navigate}
          onOpenProject={openProject}
          onCreateProject={goCreate}
        />
      );
    case "projects":
      return (
        <ProjectsView
          onNavigate={navigate}
          onOpenProject={openProject}
          onCreateProject={goCreate}
        />
      );
    case "activity":
      return <Activity onNavigate={navigate} />;
    case "disputes":
      return <Disputes onNavigate={navigate} />;
    case "settings":
      return <SettingsView onNavigate={navigate} />;
    case "create":
      // The wizard has no sidebar of its own — frame it like the other pages so
      // the user can always navigate away.
      return (
        <div className="flex min-h-screen flex-col md:flex-row">
          <SidebarNav active="projects" onNavigate={navigate} />
          <main className="min-w-0 flex-1">
            <CreateProject />
          </main>
        </div>
      );
    case "project":
      return (
        <ProjectDetails projectId={view.projectId} onNavigate={navigate} />
      );
  }
}

/* --------------------------------- Views --------------------------------- */

function ProjectsView({
  onNavigate,
  onOpenProject,
  onCreateProject,
}: {
  onNavigate: (id: NavItemId) => void;
  onOpenProject: (projectId: number) => void;
  onCreateProject: () => void;
}) {
  const wallet = useWallet();
  const [role, setRole] = useState<"client" | "freelancer">("client");
  const { projects, loading, error, refetch } = useProjects(role);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav active="projects" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1 px-6 pt-8 pb-24 md:px-10 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Projects
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              All projects you're a party to on this network.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:bg-navy-500 md:min-h-0"
            >
              <PlusIcon className="h-4 w-4" />
              New project
            </button>
            <WalletButton wallet={wallet} />
          </div>
        </header>

        {/* Role toggle — same semantics as the Dashboard's role filter. */}
        <div className="mt-6 inline-flex rounded-lg border border-ink-700 bg-ink-800/60 p-0.5 text-sm">
          {(["client", "freelancer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
                role === r
                  ? "bg-navy-600 text-white"
                  : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
          >
            <p className="text-sm font-medium text-red-200">
              Couldn't load your projects.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-400">
              {error.message}
            </p>
            <button
              type="button"
              onClick={refetch}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700 hover:text-ink-50"
            >
              <RetryIcon className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-ink-700 p-10 text-center">
            <p className="text-sm font-medium text-ink-200">
              No {role} projects yet
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Create one, or accept a client's offer — projects you're a party
              to appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                role={role}
                onSelect={() => onOpenProject(project.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SettingsView({
  onNavigate,
}: {
  onNavigate: (id: NavItemId) => void;
}) {
  const wallet = useWallet();
  const contractRows = [
    { label: "Factory", id: CONTRACTS.factory },
    { label: "Escrow", id: CONTRACTS.escrow },
    { label: "Payment vault", id: CONTRACTS.vault },
    { label: "Token", id: CONTRACTS.token },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav active="settings" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1 px-6 pt-8 pb-24 md:px-10 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Settings
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Read-only network configuration from{" "}
              <code className="font-mono text-xs">frontend/.env</code>.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        <section className="mt-6 max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60">
          <div className="border-b border-ink-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-50">Network</h2>
            <p className="mt-0.5 text-xs text-ink-400">
              StellarFlow targets a single network per build — switch by editing
              <code className="font-mono text-xs"> VITE_STELLAR_NETWORK</code>.
            </p>
          </div>
          <dl className="divide-y divide-ink-800/70">
            <SettingRow label="Network">
              <Badge tone="green">{EXPECTED_NETWORK_LABEL}</Badge>
              <span className="ml-2 font-mono text-xs text-ink-500">
                {NETWORK}
              </span>
            </SettingRow>
            <SettingRow label="RPC endpoint">
              <code className="break-all font-mono text-xs text-ink-200">
                {RPC_URL}
              </code>
            </SettingRow>
            {contractRows.map((row) => (
              <SettingRow key={row.label} label={`${row.label} contract`}>
                <code
                  className="font-mono text-xs text-ink-200"
                  title={row.id}
                >
                  {shortenAddress(row.id)}
                </code>
              </SettingRow>
            ))}
          </dl>
          <p className="border-t border-ink-800 px-5 py-3 text-xs leading-relaxed text-ink-400">
            Contract IDs come from <code className="font-mono">.env</code>. The
            bundled values are placeholders until you deploy the contracts and
            paste their real IDs.
          </p>
        </section>
      </main>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  );
}

/* --------------------------------- Icons --------------------------------- */

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
