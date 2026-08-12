"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export default function TeamPage() {
  const { currentOrganisationId } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function loadMembers() {
    if (!currentOrganisationId) return;
    apiFetch<{ members: Member[] }>(`/api/v1/organisations/${currentOrganisationId}/members`).then((r) =>
      setMembers(r.members)
    );
  }

  useEffect(loadMembers, [currentOrganisationId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganisationId) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/v1/organisations/${currentOrganisationId}/members`, {
        method: "POST",
        body: { email, role },
      });
      setEmail("");
      loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a team member</h3>
        <p className="small muted">The user must already have a FeedbackHub account.</p>
        <form className="row" onSubmit={invite}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select className="input" style={{ width: 140 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            Add
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Members</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name ?? "-"}</td>
                <td className="muted">{m.email}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
