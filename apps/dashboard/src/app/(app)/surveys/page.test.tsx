import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SurveysPage from "./page";

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

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
    return Promise.resolve({});
  });
});

function openBuilderWithOneQuestion() {
  fireEvent.click(screen.getByRole("button", { name: "+ New survey" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add question" }));
}

describe("SurveysPage - options editor", () => {
  it("shows a warning and no options until one is added, for choice/multiple_choice questions", async () => {
    render(<SurveysPage />);
    await screen.findByText("No surveys yet.");
    openBuilderWithOneQuestion();

    fireEvent.change(screen.getByDisplayValue("rating"), { target: { value: "choice" } });
    expect(screen.getByText("Add at least one option before saving.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add option" }));
    expect(screen.queryByText("Add at least one option before saving.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Option 1")).toBeInTheDocument();
  });

  it("adds and removes options independently of the question-level Remove button", async () => {
    render(<SurveysPage />);
    await screen.findByText("No surveys yet.");
    openBuilderWithOneQuestion();
    fireEvent.change(screen.getByDisplayValue("rating"), { target: { value: "multiple_choice" } });

    fireEvent.click(screen.getByRole("button", { name: "+ Add option" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add option" }));
    fireEvent.change(screen.getByPlaceholderText("Option 1"), { target: { value: "Blue" } });
    fireEvent.change(screen.getByPlaceholderText("Option 2"), { target: { value: "Green" } });

    // Two option rows + one question-level Remove button = 3 "Remove" buttons total.
    let removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(3);

    fireEvent.click(removeButtons[0]); // remove the first option ("Blue")

    removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(2); // one option + the question-level Remove
    expect(screen.getByPlaceholderText("Option 1")).toHaveValue("Green");
  });

  it("saves the survey with the entered options, deriving a slug value from each label", async () => {
    apiFetch.mockImplementation((path: string, options?: any) => {
      if (path.startsWith("/api/v1/surveys?")) return Promise.resolve({ surveys: [] });
      if (path === "/api/v1/surveys" && options?.method === "POST") return Promise.resolve({ survey: { id: "s1" } });
      return Promise.resolve({});
    });

    render(<SurveysPage />);
    await screen.findByText("No surveys yet.");
    openBuilderWithOneQuestion();
    fireEvent.change(screen.getByPlaceholderText("Survey name"), { target: { value: "Post-purchase" } });
    fireEvent.change(screen.getByDisplayValue("rating"), { target: { value: "choice" } });
    fireEvent.change(screen.getByPlaceholderText("Question text"), { target: { value: "Favourite colour?" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add option" }));
    fireEvent.change(screen.getByPlaceholderText("Option 1"), { target: { value: "Deep Blue" } });

    fireEvent.click(screen.getByRole("button", { name: "Save survey" }));

    await waitFor(() => {
      const call = apiFetch.mock.calls.find(([path, opts]) => path === "/api/v1/surveys" && opts?.method === "POST");
      expect(call).toBeTruthy();
    });

    const [, options] = apiFetch.mock.calls.find(
      ([path, opts]) => path === "/api/v1/surveys" && opts?.method === "POST"
    )!;
    expect(options.body.name).toBe("Post-purchase");
    expect(options.body.questions).toHaveLength(1);
    expect(options.body.questions[0].title).toBe("Favourite colour?");
    expect(options.body.questions[0].options).toEqual([{ label: "Deep Blue", value: "deep_blue", position: 0 }]);
  });
});
