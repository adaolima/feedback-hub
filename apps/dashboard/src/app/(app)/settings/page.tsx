"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";

export default function SettingsPage() {
  const { organisations, currentOrganisationId, refresh, setCurrentOrganisationId } = useWorkspace();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await apiFetch<{ organisation: { id: string } }>("/api/v1/organisations", {
        method: "POST",
        body: { name },
      });
      setName("");
      await refresh();
      setCurrentOrganisationId(result.organisation.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create organisation");
    } finally {
      setCreating(false);
    }
  }

  const current = organisations.find((o) => o.id === currentOrganisationId);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Current organisation</h3>
        {current ? (
          <p>
            <strong>{current.name}</strong> <span className="muted small">({current.slug})</span>
            <br />
            <span className="muted small">Your role: {current.role}</span>
          </p>
        ) : (
          <p className="muted small">No organisation selected.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a new organisation</h3>
        <form className="row" onSubmit={createOrg}>
          <input className="input" placeholder="Organisation name" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
