import { beforeEach, describe, expect, it } from "vitest";
import {
  getAnonymousId,
  getSessionId,
  saveIdentity,
  loadIdentity,
  incrementPageViews,
  getPageViews,
  getDisplayState,
  recordDisplay,
  hasShownThisSession,
} from "../src/storage";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("getAnonymousId", () => {
  it("generates and persists an id across calls", () => {
    const first = getAnonymousId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getAnonymousId()).toBe(first);
  });

  it("falls back to a fresh id per call when storage is unavailable", () => {
    const spy = window.localStorage.setItem;
    // @ts-expect-error - simulate a storage backend that throws (Safari private mode, quota, etc.)
    window.localStorage.setItem = () => {
      throw new Error("storage disabled");
    };
    const id = getAnonymousId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    window.localStorage.setItem = spy;
  });
});

describe("getSessionId", () => {
  it("generates and persists an id across calls within the session", () => {
    const first = getSessionId();
    expect(getSessionId()).toBe(first);
  });
});

describe("identity persistence", () => {
  it("round-trips through saveIdentity/loadIdentity", () => {
    expect(loadIdentity()).toBeNull();
    saveIdentity({ userId: "user-123", email: "user@example.com" });
    expect(loadIdentity()).toEqual({ userId: "user-123", email: "user@example.com" });
  });
});

describe("page views", () => {
  it("increments and reads back the count", () => {
    expect(getPageViews()).toBe(0);
    expect(incrementPageViews()).toBe(1);
    expect(incrementPageViews()).toBe(2);
    expect(getPageViews()).toBe(2);
  });
});

describe("display state", () => {
  it("defaults to zero shows", () => {
    expect(getDisplayState("widget-1")).toEqual({ lastShownAt: 0, showCount: 0 });
  });

  it("records a display, bumping showCount and lastShownAt", () => {
    const before = Date.now();
    recordDisplay("widget-1");
    const state = getDisplayState("widget-1");
    expect(state.showCount).toBe(1);
    expect(state.lastShownAt).toBeGreaterThanOrEqual(before);
    expect(hasShownThisSession("widget-1")).toBe(true);
  });

  it("does not mark an unrelated widget as shown this session", () => {
    recordDisplay("widget-1");
    expect(hasShownThisSession("widget-2")).toBe(false);
  });

  it("accumulates showCount across multiple displays", () => {
    recordDisplay("widget-1");
    recordDisplay("widget-1");
    expect(getDisplayState("widget-1").showCount).toBe(2);
  });
});
