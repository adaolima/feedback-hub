"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { AnalyticsSummary } from "@/lib/types";

export default function DashboardPage() {
  const { currentProjectId } = useWorkspace();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<AnalyticsSummary>(`/api/v1/analytics?projectId=${currentProjectId}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [currentProjectId]);

  if (!currentProjectId) {
    return <p className="muted">Create a project to see your dashboard.</p>;
  }
  if (loading) return <p className="muted">Loading...</p>;
  if (!data) return <p className="muted">No data yet.</p>;

  const metrics = [
    { label: "Total responses", value: data.summary.totalResponses },
    { label: "Average rating", value: data.summary.averageRating?.toFixed(1) ?? "-" },
    { label: "NPS", value: data.nps.score },
    { label: "Responses today", value: data.summary.responsesToday },
    { label: "Responses this week", value: data.summary.responsesThisWeek },
    { label: "Responses this month", value: data.summary.responsesThisMonth },
    { label: "Positive feedback", value: data.summary.positiveFeedback },
    { label: "Negative feedback", value: data.summary.negativeFeedback },
  ];

  const trend = data.charts.responsesOverTime.map((d) => ({
    day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: parseInt(d.count, 10),
  }));

  const ratingDist = data.charts.ratingDistribution.map((d) => ({
    rating: `${d.rating} \u2b50`,
    count: parseInt(d.count, 10),
  }));

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="grid grid-cols-4">
        {metrics.map((m) => (
          <div className="card" key={m.label}>
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Responses over time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Rating distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>NPS breakdown</h4>
          <p className="small muted">Promoters {data.nps.promoterPct}% &middot; Passives {data.nps.passivePct}% &middot; Detractors {data.nps.detractorPct}%</p>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Thumbs feedback</h4>
          <p className="small muted">{data.thumbs.up} up &middot; {data.thumbs.down} down</p>
        </div>
      </div>
    </div>
  );
}
