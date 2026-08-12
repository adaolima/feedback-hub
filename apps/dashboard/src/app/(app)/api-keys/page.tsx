"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { ApiKey } from "@/lib/types";

export default function ApiKeysPage() {
  const { currentProjectId } = useWorkspace();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "secret">("public");
  const [reveal, setReveal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!currentProjectId) return;
    apiFetch<{ apiKeys: ApiKey[] }>(`/api/v1/api-keys?projectId=${currentProjectId}`).then((r) => setKeys(r.apiKeys));
  }

  useEffect(load, [currentProjectId]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProjectId) return;
    setError(null);
    try {
      const result = await apiFetch<{ apiKey: ApiKey }>("/api/v1/api-keys", {
        method: "POST",
        body: { projectId: currentProjectId, name, type },
      });
      setName("");
      setReveal(result.apiKey.key_value ?? result.apiKey.secret ?? null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create key");
    }
  }

  async function rotateKey(id: string) {
    const result = await apiFetch<{ apiKey: ApiKey }>(`/api/v1/api-keys/${id}/rotate`, { method: "POST" });
    setReveal(result.apiKey.key_value ?? result.apiKey.secret ?? null);
    load();
  }

  async function revokeKey(id: string) {
    await apiFetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 style={{ margin: 0 }}>API Keys</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a key</h3>
        <form className="row" onSubmit={createKey}>
          <input className="input" placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="input" style={{ width: 140 }} value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="public">Public</option>
            <option value="secret">Secret</option>
          </select>
          <button className="btn btn-primary" type="submit">
            Create
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        {reveal && (
          <div className="card" style={{ marginTop: 12, background: "#fffbeb" }}>
            <p className="small">
              Copy this now &mdash; it will not be shown again: <code>{reveal}</code>
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Key</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="muted">{k.type}</td>
                <td className="muted small">{k.key_value ?? `sk_...${k.last_four}`}</td>
                <td>{k.revoked_at ? <span className="badge badge-archived">revoked</span> : <span className="badge badge-published">active</span>}</td>
                <td className="row">
                  <button className="btn" onClick={() => rotateKey(k.id)}>
                    Rotate
                  </button>
                  <button className="btn btn-danger" onClick={() => revokeKey(k.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No API keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
