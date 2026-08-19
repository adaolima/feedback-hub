import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";
import { ApiError } from "@/lib/api";

const login = vi.fn();
const replace = vi.fn();

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ login }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  login.mockReset();
  replace.mockReset();
});

describe("LoginPage", () => {
  it("pre-fills the demo credentials", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toHaveValue("demo@feedbackhub.dev");
    expect(screen.getByLabelText("Password")).toHaveValue("password123");
  });

  it("logs in and redirects to the dashboard on success", async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("demo@feedbackhub.dev", "password123"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the API error message and does not redirect on failure", async () => {
    login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("falls back to a generic error message for non-ApiError failures", async () => {
    login.mockRejectedValue(new Error("boom"));
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});
