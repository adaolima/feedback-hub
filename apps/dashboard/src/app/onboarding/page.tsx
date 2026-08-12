"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { apiFetch, ApiError } from "@/lib/api";
import { WIDGET_TYPES, DISPLAY_MODES, PRESETS, defaultQuestionConfig, buildEmbedSnippet } from "@/lib/widgetDefaults";

const STEP_LABELS = ["Organisation", "Project", "Team", "Widget", "Finish"];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { organisations, loading: workspaceLoading, refresh, setCurrentOrganisationId, setCurrentProjectId } = useWorkspace();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1: organisation
  const [orgName, setOrgName] = useState("");
  const [organisationId, setOrganisationId] = useState<string | null>(null);

  // Step 2: project
  const [projectName, setProjectName] = useState("My Website");
  const [projectId, setProjectId] = useState<string | null>(null);

  // Step 3: team (optional)
  const [teamEmail, setTeamEmail] = useState("");
  const [teamRole, setTeamRole] = useState("MEMBER");
  const [invited, setInvited] = useState<string[]>([]);

  // Step 4: widget
  const [widgetName, setWidgetName] = useState("Website Feedback");
  const [widgetType, setWidgetType] = useState("rating");
  const [displayMode, setDisplayMode] = useState("inline");
  const [preset, setPreset] = useState("modern");
  const [publishNow, setPublishNow] = useState(true);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  // Step 5: finish
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Returning user who already has an organisation: skip straight to the project step
  // instead of making them create a redundant one.
  useEffect(() => {
    if (!workspaceLoading && organisations.length > 0 && !organisationId) {
      setOrganisationId(organisations[0].id);
      setStep((s) => (s === 0 ? 1 : s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceLoading, organisations]);

  if (authLoading || !user) return null;

  async function createOrganisation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<{ organisation: { id: string } }>("/api/v1/organisations", {
        method: "POST",
        body: { name: orgName },
      });
      setOrganisationId(result.organisation.id);
      await refresh();
      setCurrentOrganisationId(result.organisation.id);
      setStep(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create organisation");
    } finally {
      setBusy(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!organisationId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<{ project: { id: string } }>("/api/v1/projects", {
        method: "POST",
        body: { organisationId, name: projectName },
      });
      setProjectId(result.project.id);
      await refresh();
      setCurrentProjectId(result.project.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  async function inviteTeammate(e: React.FormEvent) {
    e.preventDefault();
    if (!organisationId || !teamEmail) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/v1/organisations/${organisationId}/members`, {
        method: "POST",
        body: { email: teamEmail, role: teamRole },
      });
      setInvited((list) => [...list, `${teamEmail} (${teamRole})`]);
      setTeamEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function createWidget(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<{ widget: { id: string } }>("/api/v1/widgets", {
        method: "POST",
        body: {
          projectId,
          name: widgetName,
          type: widgetType,
          config: {
            displayMode,
            appearance: { preset },
            targeting: { frequency: "once_per_session" },
            question: defaultQuestionConfig(widgetType),
          },
        },
      });
      setWidgetId(result.widget.id);
      if (publishNow) {
        await apiFetch(`/api/v1/widgets/${result.widget.id}/publish`, { method: "POST" });
      }

      // Reuse an existing public key if the project already has one, otherwise mint one.
      const keys = await apiFetch<{
        apiKeys: Array<{ type: string; key_value: string | null; revoked_at: string | null }>;
      }>(`/api/v1/api-keys?projectId=${projectId}`);
      const existing = keys.apiKeys.find((k) => k.type === "public" && !k.revoked_at && k.key_value);
      if (existing?.key_value) {
        setPublicKey(existing.key_value);
      } else {
        const created = await apiFetch<{ apiKey: { key_value: string } }>("/api/v1/api-keys", {
          method: "POST",
          body: { projectId, name: "Default public key", type: "public" },
        });
        setPublicKey(created.apiKey.key_value);
      }

      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create widget");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card stack" style={{ width: 480 }}>
        <div className="wizard-steps">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className={`wizard-step${i <= step ? " active" : ""}`} title={label} />
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
        </p>

        {step === 0 && (
          <form className="stack" onSubmit={createOrganisation}>
            <h2 style={{ margin: 0 }}>Create your organisation</h2>
            <p className="muted small">This is the top-level account that owns your projects and team.</p>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Organisation name</span>
              <input
                className="input"
                placeholder="Acme Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Continue"}
            </button>
          </form>
        )}

        {step === 1 && (
          <form className="stack" onSubmit={createProject}>
            <h2 style={{ margin: 0 }}>Create your first project</h2>
            <p className="muted small">A project holds the widgets and surveys for one site or app.</p>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Project name</span>
              <input
                className="input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                autoFocus
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Continue"}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="stack">
            <h2 style={{ margin: 0 }}>Invite your team</h2>
            <p className="muted small">Optional — they must already have a FeedbackHub account. You can also do this later from Team.</p>
            <form className="row" onSubmit={inviteTeammate}>
              <input
                className="input"
                type="email"
                placeholder="teammate@company.com"
                value={teamEmail}
                onChange={(e) => setTeamEmail(e.target.value)}
              />
              <select className="input" style={{ width: 130 }} value={teamRole} onChange={(e) => setTeamRole(e.target.value)}>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button className="btn" type="submit" disabled={busy || !teamEmail}>
                Add
              </button>
            </form>
            {invited.length > 0 && (
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                {invited.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="row">
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Continue
              </button>
              <button className="btn" onClick={() => setStep(3)}>
                Skip
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form className="stack" onSubmit={createWidget}>
            <h2 style={{ margin: 0 }}>Create your first widget</h2>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Name</span>
              <input className="input" value={widgetName} onChange={(e) => setWidgetName(e.target.value)} required autoFocus />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="small">Type</span>
              <select className="input" value={widgetType} onChange={(e) => setWidgetType(e.target.value)}>
                {WIDGET_TYPES.filter((t) => t !== "survey").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
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
            <label className="row small">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              Publish immediately so it's ready to embed
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Continue"}
            </button>
          </form>
        )}

        {step === 4 && (
          <div className="stack">
            <h2 style={{ margin: 0 }}>You&rsquo;re all set</h2>
            <p className="muted small">Add this snippet to your site to start collecting feedback.</p>
            {publicKey && widgetId && (
              <textarea className="input" rows={9} readOnly value={buildEmbedSnippet(publicKey, widgetId)} />
            )}
            <div className="row">
              <button className="btn btn-primary" onClick={() => router.replace("/widgets")}>
                Go to Widgets
              </button>
              <button className="btn" onClick={() => router.replace("/dashboard")}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
