import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResponsesPage from "./page";
import { FeedbackResponse } from "@/lib/types";

const apiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  getAccessToken: () => "token",
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/WorkspaceContext", () => ({
  useWorkspace: () => ({ currentProjectId: "proj-1" }),
}));

function response(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
  return {
    id: "r1",
    project_id: "proj-1",
    widget_id: "w1",
    survey_id: null,
    user_id: null,
    anonymous_id: "anon-1",
    session_id: "sess-1",
    rating: null,
    nps_score: null,
    feedback_text: "Loved it",
    metadata: { pageUrl: "https://example.com/checkout" },
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/responses?")) {
      return Promise.resolve({ responses: [response()], pagination: { total: 1 } });
    }
    if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
    return Promise.resolve({});
  });
});

describe("ResponsesPage", () => {
  it("lists responses loaded from the API", async () => {
    render(<ResponsesPage />);
    expect(await screen.findByText("Loved it")).toBeInTheDocument();
  });

  it("shows an empty state when there are no responses", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/responses?")) return Promise.resolve({ responses: [], pagination: { total: 0 } });
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
      return Promise.resolve({});
    });
    render(<ResponsesPage />);
    expect(await screen.findByText("No responses yet.")).toBeInTheDocument();
  });

  it("opens the detail modal and renders question_title labels with joined optionLabels", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/responses?")) {
        return Promise.resolve({ responses: [response()], pagination: { total: 1 } });
      }
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
      if (path === "/api/v1/responses/r1") {
        return Promise.resolve({
          response: response({
            answers: [
              {
                id: "a1",
                question_id: "q1",
                question_title: "Which features do you use?",
                type: "multiple_choice",
                value: ["dashboards", "webhooks"],
                optionLabels: ["Dashboards", "Webhooks"],
              },
              {
                id: "a2",
                question_id: "q2",
                question_title: "Anything else?",
                type: "text",
                value: "Nope, all good",
              },
            ],
          }),
        });
      }
      return Promise.resolve({});
    });

    render(<ResponsesPage />);
    fireEvent.click(await screen.findByText("Loved it"));

    const choiceLabel = await screen.findByText("Which features do you use?:");
    expect(choiceLabel.closest("p")).toHaveTextContent("Dashboards, Webhooks");

    const textLabel = screen.getByText("Anything else?:");
    expect(textLabel.closest("p")).toHaveTextContent("Nope, all good");
  });

  it("falls back to the raw value when an answer has no resolved optionLabels", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/responses?")) {
        return Promise.resolve({ responses: [response()], pagination: { total: 1 } });
      }
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
      if (path === "/api/v1/responses/r1") {
        return Promise.resolve({
          response: response({
            answers: [
              { id: "a1", question_id: "q1", question_title: "Score", type: "rating", value: 4 },
            ],
          }),
        });
      }
      return Promise.resolve({});
    });

    render(<ResponsesPage />);
    fireEvent.click(await screen.findByText("Loved it"));

    const label = await screen.findByText("Score:");
    expect(label.closest("p")).toHaveTextContent("4");
  });
});
