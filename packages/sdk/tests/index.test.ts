import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadIdentity } from "../src/storage";

vi.mock("../src/api", () => ({ ApiClient: vi.fn() }));

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function freshClient() {
  vi.resetModules();
  const { ApiClient } = await import("../src/api");
  const module = await import("../src/index");
  return { client: module.default, ApiClient: ApiClient as unknown as ReturnType<typeof vi.fn> };
}

function mockApiImpl(ApiClientMock: ReturnType<typeof vi.fn>, overrides: Partial<Record<string, unknown>> = {}) {
  ApiClientMock.mockImplementation(() => ({
    getConfig: vi.fn().mockResolvedValue({ projectId: "p1", widgets: [] }),
    submitResponse: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }));
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete (window as any).FeedbackHubConfig;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("init()", () => {
  it("does nothing when projectKey is missing, instead of throwing", async () => {
    const { client, ApiClient } = await freshClient();
    // Note: the projectKey check runs before `this.debug` is set from options, so this particular
    // warning is never actually visible via console.warn even with debug:true - the safe-degradation
    // contract we're verifying here is that init() still doesn't set up any state or throw.
    expect(() => client.init({ debug: true } as any)).not.toThrow();

    expect(ApiClient).not.toHaveBeenCalled();
  });

  it("renders an inline widget into its matching container", async () => {
    const { client, ApiClient } = await freshClient();
    mockApiImpl(ApiClient, {
      getConfig: vi.fn().mockResolvedValue({
        projectId: "p1",
        widgets: [
          {
            id: "w1",
            name: "My Widget",
            type: "rating",
            config: { displayMode: "inline", question: { min: 1, max: 5 } },
          },
        ],
      }),
    });

    const container = document.createElement("div");
    container.setAttribute("data-feedback-widget", "My Widget");
    document.body.appendChild(container);

    client.init({ projectKey: "pk_test", apiBaseUrl: "https://api.example.com" });
    await flush();

    expect(container.querySelector('[data-feedbackhub-widget="w1"]')).not.toBeNull();
  });

  it("warns instead of throwing when the remote config can't be loaded", async () => {
    const { client, ApiClient } = await freshClient();
    mockApiImpl(ApiClient, { getConfig: vi.fn().mockResolvedValue(null) });

    expect(() => client.init({ projectKey: "pk_test", debug: true } as any)).not.toThrow();
    await flush();

    expect(console.warn).toHaveBeenCalledWith("[FeedbackHub]", "Could not load FeedbackHub configuration");
  });

  it("is a no-op on a second call once already initialized", async () => {
    const { client, ApiClient } = await freshClient();
    mockApiImpl(ApiClient);

    client.init({ projectKey: "pk_test" });
    await flush();
    client.init({ projectKey: "pk_other" });
    await flush();

    expect(ApiClient).toHaveBeenCalledTimes(1);
  });
});

describe("track()", () => {
  it("does not throw when called before init()", async () => {
    const { client, ApiClient } = await freshClient();
    expect(() => client.track("checkout_completed")).not.toThrow();
    expect(ApiClient).not.toHaveBeenCalled();
  });
});

describe("identify()", () => {
  it("merges successive identity calls into persisted storage", async () => {
    const { client } = await freshClient();
    client.identify({ userId: "user-123" });
    client.identify({ email: "user@example.com" });

    expect(loadIdentity()).toEqual({ userId: "user-123", email: "user@example.com" });
  });
});

describe("open()/close()", () => {
  it("warns instead of throwing when opening a widget that doesn't exist", async () => {
    const { client, ApiClient } = await freshClient();
    mockApiImpl(ApiClient);
    client.init({ projectKey: "pk_test", debug: true });
    await flush();

    expect(() => client.open("does-not-exist")).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      "[FeedbackHub]",
      'No widget found for "does-not-exist"'
    );
  });

  it("does not throw when closing a widget that was never opened", async () => {
    const { client } = await freshClient();
    expect(() => client.close("never-opened")).not.toThrow();
  });
});
