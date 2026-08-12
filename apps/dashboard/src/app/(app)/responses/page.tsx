"use client";

import { useEffect, useState } from "react";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { FeedbackResponse, Widget } from "@/lib/types";

export default function ResponsesPage() {
  const { currentProjectId } = useWorkspace();
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [widgetId, setWidgetId] = useState("");
  const [selected, setSelected] = useState<FeedbackResponse | null>(null);
  const pageSize = 20;

  function load() {
    if (!currentProjectId) return;
    const params = new URLSearchParams({ projectId: currentProjectId, page: String(page), pageSize: String(pageSize) });
    if (search) params.set("search", search);
    if (widgetId) params.set("widgetId", widgetId);
    apiFetch<{ responses: FeedbackResponse[]; pagination: { total: number } }>(`/api/v1/responses?${params}`).then(
      (r) => {
        setResponses(r.responses);
        setTotal(r.pagination.total);
      }
    );
  }

  useEffect(load, [currentProjectId, page, search, widgetId]);

  useEffect(() => {
    if (!currentProjectId) return;
    apiFetch<{ widgets: Widget[] }>(`/api/v1/widgets?projectId=${currentProjectId}`).then((r) => setWidgets(r.widgets));
  }, [currentProjectId]);

  async function viewResponse(id: string) {
    const result = await apiFetch<{ response: FeedbackResponse }>(`/api/v1/responses/${id}`);
    setSelected(result.response);
  }

  async function exportResponses(format: "csv" | "json") {
    if (!currentProjectId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiUrl}/api/v1/responses/export/${format}?projectId=${currentProjectId}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `responses.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="between">
        <h2 style={{ margin: 0 }}>Responses</h2>
        <div className="row">
          <button className="btn" onClick={() => exportResponses("csv")}>
            Export CSV
          </button>
          <button className="btn" onClick={() => exportResponses("json")}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="card row">
        <input className="input" placeholder="Search feedback text..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 200 }} value={widgetId} onChange={(e) => setWidgetId(e.target.value)}>
          <option value="">All widgets</option>
          {widgets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Feedback</th>
              <th>Rating / NPS</th>
              <th>Page</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => viewResponse(r.id)}>
                <td>{r.feedback_text ?? <span className="muted">-</span>}</td>
                <td className="muted">
                  {r.rating !== null ? `${r.rating >= 4 ? "\u2B50".repeat(Math.min(r.rating, 5)) : r.rating}` : ""}
                  {r.nps_score !== null ? `NPS ${r.nps_score}` : ""}
                </td>
                <td className="muted small">{r.metadata?.pageUrl ?? "-"}</td>
                <td className="muted small">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="small muted">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button className="btn" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal stack" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Response</h3>
            {selected.rating !== null && <p>Rating: {selected.rating}</p>}
            {selected.nps_score !== null && <p>NPS score: {selected.nps_score}</p>}
            {selected.feedback_text && <p>Feedback: &ldquo;{selected.feedback_text}&rdquo;</p>}
            {selected.answers && selected.answers.length > 0 && (
              <div className="stack" style={{ gap: 4 }}>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  Survey answers:
                </p>
                {selected.answers.map((a) => (
                  <p key={a.id} style={{ margin: 0 }}>
                    <span className="muted">{a.question_title ?? a.type}:</span>{" "}
                    {a.optionLabels
                      ? a.optionLabels.join(", ")
                      : typeof a.value === "object"
                        ? JSON.stringify(a.value)
                        : String(a.value)}
                  </p>
                ))}
              </div>
            )}
            <p className="muted small">Page: {selected.metadata?.pageUrl ?? "-"}</p>
            <p className="muted small">
              Device: {selected.metadata?.deviceType ?? "-"} &middot; Browser: {selected.metadata?.browser ?? "-"} &middot; OS: {selected.metadata?.os ?? "-"}
            </p>
            <p className="muted small">Country: {selected.metadata?.country ?? "-"}</p>
            <p className="muted small">Submitted: {new Date(selected.created_at).toLocaleString()}</p>
            <button className="btn" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
