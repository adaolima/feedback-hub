"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/lib/WorkspaceContext";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/widgets", label: "Widgets" },
  { href: "/surveys", label: "Surveys" },
  { href: "/responses", label: "Responses" },
  { href: "/analytics", label: "Analytics" },
  { href: "/integrations", label: "Integrations" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const {
    organisations,
    projects,
    currentOrganisationId,
    currentProjectId,
    setCurrentOrganisationId,
    setCurrentProjectId,
    loading: workspaceLoading,
  } = useWorkspace();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Nothing to manage yet (new account, or an existing one with no org) — send them through setup
  // instead of dropping them into an app shell with empty org/project selectors.
  useEffect(() => {
    if (!loading && user && !workspaceLoading && organisations.length === 0) router.replace("/onboarding");
  }, [loading, user, workspaceLoading, organisations, router]);

  if (loading || !user || (!workspaceLoading && organisations.length === 0)) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">FeedbackHub</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${pathname === item.href ? " active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <button className="btn" style={{ width: "100%" }} onClick={() => logout().then(() => router.replace("/login"))}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <select
              className="input"
              style={{ width: 200 }}
              value={currentOrganisationId ?? ""}
              onChange={(e) => setCurrentOrganisationId(e.target.value)}
            >
              {organisations.length === 0 && <option value="">No organisations</option>}
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: 200 }}
              value={currentProjectId ?? ""}
              onChange={(e) => setCurrentProjectId(e.target.value)}
            >
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <span className="muted small">{user.email}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
