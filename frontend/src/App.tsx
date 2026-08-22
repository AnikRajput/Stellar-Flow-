/**
 * StellarFlow app shell — redesigned for premium SaaS look.
 *
 * State-driven navigation (no router). Each page keeps its own SidebarNav
 * and receives an `onNavigate` callback.
 */

import { useCallback, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { TopHeader } from "@/components/layout/TopHeader";
import {
  ProjectCard,
  ProjectCardSkeleton,
} from "@/components/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
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

/** The full set of shell views. */
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

      <main className="min-w-0 flex-1">
        <TopHeader
          title="Projects"
          subtitle="All projects you're a party to on this network."
          wallet={wallet}
          action={{
            label: "New Project",
            onClick: onCreateProject,
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            ),
          }}
        />

        <div className="px-6 py-6 lg:px-8">
          {/* Role toggle */}
          <div className="inline-flex rounded-lg border border-border-subtle bg-surface-2/60 p-0.5 text-[13px]">
            {(["client", "freelancer"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-md px-3 py-1.5 font-medium capitalize transition-all duration-150 ${
                  role === r
                    ? "bg-accent-500/15 text-accent-300"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="mt-4">
              <ErrorState
                title="Couldn't load your projects"
                message={error.message}
                onRetry={refetch}
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    <path d="M12 11v6" />
                    <path d="M9 14h6" />
                  </svg>
                }
                title={`No ${role} projects yet`}
                description="Create one, or accept a client's offer — projects you're a party to appear here."
                action={{
                  label: "Create Project",
                  onClick: onCreateProject,
                  icon: (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  ),
                }}
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        </div>
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

      <main className="min-w-0 flex-1">
        <TopHeader
          title="Settings"
          subtitle="Read-only network configuration from frontend/.env."
          wallet={wallet}
        />

        <div className="px-6 py-6 lg:px-8">
          <section className="max-w-xl rounded-xl border border-border-subtle bg-surface-2/60">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Network
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                StellarFlow targets a single network per build — switch by
                editing{" "}
                <code className="font-mono text-[11px]">VITE_STELLAR_NETWORK</code>.
              </p>
            </div>
            <dl className="divide-y divide-border-subtle">
              <SettingRow label="Network">
                <Badge tone="green">{EXPECTED_NETWORK_LABEL}</Badge>
                <span className="ml-2 font-mono text-[11px] text-text-tertiary">
                  {NETWORK}
                </span>
              </SettingRow>
              <SettingRow label="RPC endpoint">
                <code className="break-all font-mono text-[11px] text-text-secondary">
                  {RPC_URL}
                </code>
              </SettingRow>
              {contractRows.map((row) => (
                <SettingRow key={row.label} label={`${row.label} contract`}>
                  <code
                    className="font-mono text-[11px] text-text-secondary"
                    title={row.id}
                  >
                    {shortenAddress(row.id)}
                  </code>
                </SettingRow>
              ))}
            </dl>
            <p className="border-t border-border-subtle px-5 py-3 text-[11px] leading-relaxed text-text-tertiary">
              Contract IDs come from{" "}
              <code className="font-mono">.env</code>. The bundled values are
              placeholders until you deploy the contracts and paste their real
              IDs.
            </p>
          </section>
        </div>
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
      <dt className="text-[11px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  );
}
