"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { Organisation, Project } from "./types";
import { useAuth } from "./AuthContext";

interface WorkspaceContextValue {
  organisations: Organisation[];
  projects: Project[];
  currentOrganisationId: string | null;
  currentProjectId: string | null;
  setCurrentOrganisationId: (id: string) => void;
  setCurrentProjectId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentOrganisationId, setCurrentOrganisationIdState] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganisations([]);
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const orgResult = await apiFetch<{ organisations: Organisation[] }>("/api/v1/organisations");
      setOrganisations(orgResult.organisations);

      const storedOrg = localStorage.getItem("fh_current_org");
      const orgId = storedOrg && orgResult.organisations.some((o) => o.id === storedOrg) ? storedOrg : orgResult.organisations[0]?.id ?? null;
      setCurrentOrganisationIdState(orgId);

      if (orgId) {
        const projectResult = await apiFetch<{ projects: Project[] }>(`/api/v1/projects?organisationId=${orgId}`);
        setProjects(projectResult.projects);
        const storedProject = localStorage.getItem("fh_current_project");
        const projectId =
          storedProject && projectResult.projects.some((p) => p.id === storedProject)
            ? storedProject
            : projectResult.projects[0]?.id ?? null;
        setCurrentProjectIdState(projectId);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentOrganisationId = useCallback((id: string) => {
    setCurrentOrganisationIdState(id);
    localStorage.setItem("fh_current_org", id);
    apiFetch<{ projects: Project[] }>(`/api/v1/projects?organisationId=${id}`).then((result) => {
      setProjects(result.projects);
      const projectId = result.projects[0]?.id ?? null;
      setCurrentProjectIdState(projectId);
      if (projectId) localStorage.setItem("fh_current_project", projectId);
    });
  }, []);

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentProjectIdState(id);
    localStorage.setItem("fh_current_project", id);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        organisations,
        projects,
        currentOrganisationId,
        currentProjectId,
        setCurrentOrganisationId,
        setCurrentProjectId,
        refresh,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
