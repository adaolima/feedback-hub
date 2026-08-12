"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { Webhook } from "@/lib/types";

const EVENTS = ["response.created", "response.updated", "survey.completed", "widget.published"];

export default function IntegrationsPage() {
  const { currentProjectId } = useWorkspace();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["response.created"]);
  const [reveal, setReveal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!currentProjectId) return;
    apiFetch<{ webhooks: Webhook[] }>(`/api/v1/webhooks?projectId=${currentProjectId}`).then((r) => setWebhooks(r.webhooks));
  }

  useEffect(load, [currentProjectId]);

  function toggleEvent(event: string) {
    setEvents((evs) => (evs.includes(event) ? evs.filter((e) => e !== event) : [...evs, event]));
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProjectId) return;
    setError(null);
    try {
      const result = await apiFetch<{ webhook: Webhook }>("/api/v1/webhooks", {
        method: "POST",
        body: { projectId: currentProjectId, url, events },
      });
      setUrl("");
      setReveal(result.webhook.secret ?? null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create webhook");
    }
  }

  async function toggleActive(webhook: Webhook) {
    await apiFetch(`/api/v1/webhooks/${webhook.id}`, { method: "PATCH", body: { active: !webhook.active } });
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/v1/webhooks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h2 style={{ margin: 0 }}>Integrations</h2>
      <p className="muted small">
        Webhooks let external systems (Slack, Zapier, your own backend...) react to FeedbackHub events. Each
        request is signed with HMAC-SHA256 using the webhook secret.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a webhook</h3>
        <form className="stack" onSubmit={createWebhook}>
          <input className="input" placeholder="https://example.com/webhooks/feedbackhub" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <div className="row">
            {EVENTS.map((event) => (
              <label key={event} className="row small">
                <input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} />
                {event}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "fit-content" }}>
            Create webhook
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        {reveal && (
          <div className="card" style={{ marginTop: 12, background: "#fffbeb" }}>
            <p className="small">
              Webhook secret (copy now): <code>{reveal}</code>
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Events</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((w) => (
              <tr key={w.id}>
                <td className="small">{w.url}</td>
                <td className="muted small">{w.events.join(", ")}</td>
                <td>{w.active ? <span className="badge badge-published">active</span> : <span className="badge badge-draft">paused</span>}</td>
                <td className="row">
                  <button className="btn" onClick={() => toggleActive(w)}>
                    {w.active ? "Pause" : "Resume"}
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(w.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No webhooks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
