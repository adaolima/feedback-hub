"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { Widget, Survey } from "@/lib/types";
import { WIDGET_TYPES, DISPLAY_MODES, PRESETS, defaultQuestionConfig, buildEmbedSnippet } from "@/lib/widgetDefaults";

export default function WidgetsPage() {
  const { currentProjectId } = useWorkspace();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("rating");
  const [displayMode, setDisplayMode] = useState("inline");
  const [preset, setPreset] = useState("modern");
  const [surveyId, setSurveyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Widget | null>(null);

  function loadWidgets() {
    if (!currentProjectId) return;
    apiFetch<{ widgets: Widget[] }>(`/api/v1/widgets?projectId=${currentProjectId}`).then((r) => setWidgets(r.widgets));
    apiFetch<{ surveys: Survey[] }>(`/api/v1/surveys?projectId=${currentProjectId}`).then((r) => setSurveys(r.surveys));
  }

  useEffect(loadWidgets, [currentProjectId]);

  async function createWidget(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProjectId) return;
    setError(null);
    setCreating(true);
    try {
      await apiFetch("/api/v1/widgets", {
        method: "POST",
        body: {
          projectId: currentProjectId,
          name,
          type,
          surveyId: type === "survey" ? surveyId || undefined : undefined,
          config: {
            displayMode,
            appearance: { preset },
            targeting: { frequency: "once_per_session" },
            question: defaultQuestionConfig(type),
          },
        },
      });
      setShowCreate(false);
      setName("");
      loadWidgets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create widget");
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(widget: Widget) {
    const action = widget.status === "published" ? "unpublish" : "publish";
    await apiFetch(`/api/v1/widgets/${widget.id}/${action}`, { method: "POST" });
    loadWidgets();
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="between">
        <h2 style={{ margin: 0 }}>Widgets</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!currentProjectId}>
          + New widget
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Display mode</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {widgets.map((w) => (
              <tr key={w.id}>
                <td>
                  <a href="#" onClick={(e) => { e.preventDefault(); setSelected(w); }}>
                    {w.name}
                  </a>
                </td>
                <td className="muted">{w.type}</td>
                <td>
                  <span className={`badge badge-${w.status}`}>{w.status}</span>
                </td>
                <td className="muted">{w.config?.displayMode ?? "inline"}</td>
                <td>
                  <button className="btn" onClick={() => togglePublish(w)}>
                    {w.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                </td>
              </tr>
            ))}
            {widgets.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No widgets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal stack" onClick={(e) => e.stopPropagation()} onSubmit={createWidget}>
            <h3 style={{ marginTop: 0 }}>New widget</h3>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Type</span>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {WIDGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {type === "survey" && (
              <label className="stack" style={{ gap: 4 }}>
                <span className="small">Survey</span>
                <select className="input" value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
                  <option value="">Select a survey</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Display mode</span>
              <select className="input" value={displayMode} onChange={(e) => setDisplayMode(e.target.value)}>
                {DISPLAY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Style preset</span>
              <select className="input" value={preset} onChange={(e) => setPreset(e.target.value)}>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create widget"}
              </button>
              <button className="btn" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && <EmbedModal widget={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function EmbedModal({ widget, onClose }: { widget: Widget; onClose: () => void }) {
  const snippet = buildEmbedSnippet("pk_your_public_key", widget.id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{widget.name} - Embed code</h3>
        <textarea className="input" rows={10} readOnly value={snippet} />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
