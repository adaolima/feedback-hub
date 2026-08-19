import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WidgetsPage from "./page";
import { Widget } from "@/lib/types";

const apiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/WorkspaceContext", () => ({
  useWorkspace: () => ({ currentProjectId: "proj-1" }),
}));

function widget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: "w1",
    project_id: "proj-1",
    survey_id: null,
    name: "Website Rating",
    type: "rating",
    config: { displayMode: "inline" },
    status: "draft",
    published_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  apiFetch.mockReset();
});

function mockLoadWidgets(widgets: Widget[] = []) {
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets });
    if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
    if (path.startsWith("/api/v1/api-keys?")) return Promise.resolve({ apiKeys: [] });
    return Promise.resolve({});
  });
}

describe("WidgetsPage", () => {
  it("lists widgets loaded from the API", async () => {
    mockLoadWidgets([widget({ name: "Website Rating" }), widget({ id: "w2", name: "NPS Survey", status: "published" })]);
    render(<WidgetsPage />);

    expect(await screen.findByText("Website Rating")).toBeInTheDocument();
    expect(screen.getByText("NPS Survey")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
  });

  it("shows an empty state when there are no widgets yet", async () => {
    mockLoadWidgets([]);
    render(<WidgetsPage />);

    expect(await screen.findByText("No widgets yet.")).toBeInTheDocument();
  });

  it("creates a widget with the NPS follow-up question when the checkbox is checked", async () => {
    mockLoadWidgets([]);
    apiFetch.mockImplementation((path: string, options?: any) => {
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
      if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
      if (path.startsWith("/api/v1/api-keys?")) return Promise.resolve({ apiKeys: [] });
      if (path === "/api/v1/widgets" && options?.method === "POST") return Promise.resolve({ widget: { id: "new" } });
      return Promise.resolve({});
    });

    render(<WidgetsPage />);
    await screen.findByText("No widgets yet.");

    fireEvent.click(screen.getByRole("button", { name: "+ New widget" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "NPS Survey" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "nps" } });
    fireEvent.click(screen.getByLabelText("Ask respondents to justify their score"));
    fireEvent.click(screen.getByRole("button", { name: "Create widget" }));

    await waitFor(() => {
      const call = apiFetch.mock.calls.find(([path, opts]) => path === "/api/v1/widgets" && opts?.method === "POST");
      expect(call).toBeTruthy();
    });

    const [, options] = apiFetch.mock.calls.find(
      ([path, opts]) => path === "/api/v1/widgets" && opts?.method === "POST"
    )!;
    expect(options.body.name).toBe("NPS Survey");
    expect(options.body.type).toBe("nps");
    expect(options.body.config.question.followUpQuestion).toBe("What's the main reason for your score?");
  });

  it("omits the follow-up question from the payload when the checkbox is left unchecked", async () => {
    mockLoadWidgets([]);
    apiFetch.mockImplementation((path: string, options?: any) => {
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [] });
      if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
      if (path.startsWith("/api/v1/api-keys?")) return Promise.resolve({ apiKeys: [] });
      if (path === "/api/v1/widgets" && options?.method === "POST") return Promise.resolve({ widget: { id: "new" } });
      return Promise.resolve({});
    });

    render(<WidgetsPage />);
    await screen.findByText("No widgets yet.");

    fireEvent.click(screen.getByRole("button", { name: "+ New widget" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "NPS Survey" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "nps" } });
    fireEvent.click(screen.getByRole("button", { name: "Create widget" }));

    await waitFor(() => {
      const call = apiFetch.mock.calls.find(([path, opts]) => path === "/api/v1/widgets" && opts?.method === "POST");
      expect(call).toBeTruthy();
    });

    const [, options] = apiFetch.mock.calls.find(
      ([path, opts]) => path === "/api/v1/widgets" && opts?.method === "POST"
    )!;
    expect(options.body.config.question.followUpQuestion).toBeUndefined();
  });

  it("toggles publish state via the Publish/Unpublish button", async () => {
    mockLoadWidgets([widget({ status: "draft" })]);
    apiFetch.mockImplementation((path: string, options?: any) => {
      if (path.startsWith("/api/v1/widgets?")) return Promise.resolve({ widgets: [widget({ status: "draft" })] });
      if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
      if (path.startsWith("/api/v1/api-keys?")) return Promise.resolve({ apiKeys: [] });
      if (path === "/api/v1/widgets/w1/publish") return Promise.resolve({});
      return Promise.resolve({});
    });

    render(<WidgetsPage />);
    const row = (await screen.findByText("Website Rating")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/v1/widgets/w1/publish", { method: "POST" });
    });
  });
});
