"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { Survey, SurveyQuestion } from "@/lib/types";

const QUESTION_TYPES = ["rating", "nps", "thumbs", "emoji", "text", "choice", "multiple_choice"];

interface DraftQuestion {
  type: string;
  title: string;
  required: boolean;
  position: number;
  config: Record<string, any>;
  conditionalLogic: Record<string, any>;
  options: Array<{ label: string; value: string; position: number }>;
}

export default function SurveysPage() {
  const { currentProjectId } = useWorkspace();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  function loadSurveys() {
    if (!currentProjectId) return;
    apiFetch<{ surveys: Survey[] }>(`/api/v1/surveys?projectId=${currentProjectId}`).then((r) => setSurveys(r.surveys));
  }

  useEffect(loadSurveys, [currentProjectId]);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { type: "rating", title: "New question", required: false, position: qs.length, config: {}, conditionalLogic: {}, options: [] },
    ]);
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const target = index + direction;
      if (target < 0 || target >= next.length) return qs;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((q, i) => ({ ...q, position: i }));
    });
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index).map((q, i) => ({ ...q, position: i })));
  }

  async function saveSurvey(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProjectId) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/v1/surveys", {
        method: "POST",
        body: { projectId: currentProjectId, name, questions },
      });
      setName("");
      setQuestions([]);
      setShowBuilder(false);
      loadSurveys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save survey");
    } finally {
      setSaving(false);
    }
  }

  async function publishSurvey(id: string) {
    await apiFetch(`/api/v1/surveys/${id}/publish`, { method: "POST" });
    loadSurveys();
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="between">
        <h2 style={{ margin: 0 }}>Surveys</h2>
        <button className="btn btn-primary" onClick={() => setShowBuilder(true)} disabled={!currentProjectId}>
          + New survey
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Questions</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{s.questions?.length ?? 0}</td>
                <td>
                  <span className={`badge badge-${s.status}`}>{s.status}</span>
                </td>
                <td>
                  {s.status !== "published" && (
                    <button className="btn" onClick={() => publishSurvey(s.id)}>
                      Publish
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No surveys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showBuilder && (
        <div className="modal-backdrop" onClick={() => setShowBuilder(false)}>
          <form
            className="modal stack"
            style={{ width: 640 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveSurvey}
          >
            <h3 style={{ marginTop: 0 }}>Build a survey</h3>
            <input className="input" placeholder="Survey name" value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="stack">
              {questions.map((q, i) => (
                <div key={i} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <input
                      className="input"
                      value={q.title}
                      onChange={(e) => updateQuestion(i, { title: e.target.value })}
                      placeholder="Question text"
                    />
                    <select
                      className="input"
                      style={{ width: 150 }}
                      value={q.type}
                      onChange={(e) => updateQuestion(i, { type: e.target.value })}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="row small">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn" onClick={() => moveQuestion(i, -1)}>
                      &uarr;
                    </button>
                    <button type="button" className="btn" onClick={() => moveQuestion(i, 1)}>
                      &darr;
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => removeQuestion(i)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn" onClick={addQuestion}>
              + Add question
            </button>

            {error && <p className="error-text">{error}</p>}
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save survey"}
              </button>
              <button className="btn" type="button" onClick={() => setShowBuilder(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
