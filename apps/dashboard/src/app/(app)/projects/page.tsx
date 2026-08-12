"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";

export default function ProjectsPage() {
  const { organisations, projects, currentOrganisationId, refresh, setCurrentProjectId } = useWorkspace();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganisationId) return;
    setError(null);
    setCreating(true);
    try {
      const result = await apiFetch<{ project: { id: string } }>("/api/v1/projects", {
        method: "POST",
        body: { organisationId: currentOrganisationId, name },
      });
      setName("");
      await refresh();
      setCurrentProjectId(result.project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a project</h3>
        {organisations.length === 0 ? (
          <p className="muted small">Create an organisation first (see Settings).</p>
        ) : (
          <form className="row" onSubmit={createProject}>
            <input
              className="input"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create project"}
            </button>
          </form>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Projects</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">{p.slug}</td>
                <td className="muted">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
