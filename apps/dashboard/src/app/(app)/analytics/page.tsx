"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { AnalyticsSummary } from "@/lib/types";

const RANGES: Array<{ label: string; days: number | null }> = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

export default function AnalyticsPage() {
  const { currentProjectId } = useWorkspace();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [rangeDays, setRangeDays] = useState<number | null>(30);

  useEffect(() => {
    if (!currentProjectId) return;
    const params = new URLSearchParams({ projectId: currentProjectId });
    if (rangeDays) {
      const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
      params.set("from", from.toISOString());
    }
    apiFetch<AnalyticsSummary>(`/api/v1/analytics?${params}`).then(setData);
  }, [currentProjectId, rangeDays]);

  if (!currentProjectId) return <p className="muted">Select a project to view analytics.</p>;
  if (!data) return <p className="muted">Loading...</p>;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="between">
        <h2 style={{ margin: 0 }}>Analytics</h2>
        <div className="row">
          {RANGES.map((r) => (
            <button
              key={r.label}
              className="btn"
              style={rangeDays === r.days ? { borderColor: "var(--primary)", color: "var(--primary)" } : undefined}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4">
        <div className="card">
          <div className="metric-value">{data.summary.totalResponses}</div>
          <div className="metric-label">Responses</div>
        </div>
        <div className="card">
          <div className="metric-value">{data.nps.score}</div>
          <div className="metric-label">NPS</div>
        </div>
        <div className="card">
          <div className="metric-value">{data.summary.averageRating?.toFixed(1) ?? "-"}</div>
          <div className="metric-label">Average rating</div>
        </div>
        <div className="card">
          <div className="metric-value">
            {data.thumbs.up + data.thumbs.down > 0
              ? Math.round((data.thumbs.up / (data.thumbs.up + data.thumbs.down)) * 100)
              : 0}
            %
          </div>
          <div className="metric-label">Thumbs-up rate</div>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Promoters</h4>
          <div className="metric-value">{data.nps.promoterPct}%</div>
          <span className="muted small">{data.nps.promoters} responses</span>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Passives</h4>
          <div className="metric-value">{data.nps.passivePct}%</div>
          <span className="muted small">{data.nps.passives} responses</span>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Detractors</h4>
          <div className="metric-value">{data.nps.detractorPct}%</div>
          <span className="muted small">{data.nps.detractors} responses</span>
        </div>
      </div>
    </div>
  );
}
