import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api";

describe("ApiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getConfig requests the public config endpoint with the project key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ projectId: "p1", widgets: [] }) });
    const client = new ApiClient("https://api.example.com", "pk_test");
    const config = await client.getConfig();

    expect(config).toEqual({ projectId: "p1", widgets: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/v1/public/config?projectKey=pk_test");
    expect(init.headers["X-Project-Key"]).toBe("pk_test");
  });

  it("submitResponse posts to /api/v1/responses with the project key merged into the body", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "r1" }) });
    const client = new ApiClient("https://api.example.com", "pk_test");
    await client.submitResponse({ widgetId: "w1", rating: 5 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/v1/responses");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ widgetId: "w1", rating: 5, projectKey: "pk_test" });
  });

  it("trackEvent posts to /api/v1/public/events with name, properties, and identity ids", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new ApiClient("https://api.example.com", "pk_test");
    await client.trackEvent("checkout_completed", { plan: "pro" }, { anonymousId: "a1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      projectKey: "pk_test",
      name: "checkout_completed",
      properties: { plan: "pro" },
      anonymousId: "a1",
    });
  });

  it("resolves to null instead of throwing on a non-OK response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "nope" }) });
    const client = new ApiClient("https://api.example.com", "pk_test");
    await expect(client.getConfig()).resolves.toBeNull();
  });

  it("resolves to null instead of throwing when the network request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const client = new ApiClient("https://api.example.com", "pk_test");
    await expect(client.getConfig()).resolves.toBeNull();
    await expect(client.submitResponse({})).resolves.toBeNull();
  });
});
