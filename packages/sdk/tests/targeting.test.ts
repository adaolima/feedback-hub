import { beforeEach, describe, expect, it } from "vitest";
import { matchesUrl, passesFrequency, passesPageViews, isEligible } from "../src/targeting";
import { incrementPageViews, recordDisplay } from "../src/storage";
import { Widget } from "../src/types";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("matchesUrl", () => {
  it("matches any URL when no patterns are given", () => {
    expect(matchesUrl(undefined)).toBe(true);
    expect(matchesUrl([])).toBe(true);
  });

  it("matches when the current URL contains any pattern", () => {
    expect(matchesUrl([window.location.href])).toBe(true);
    expect(matchesUrl(["/some/other/path/that/does/not/match"])).toBe(false);
  });
});

describe("passesFrequency", () => {
  it("always passes for 'always' and undefined", () => {
    expect(passesFrequency("w1", "always")).toBe(true);
    expect(passesFrequency("w1", undefined)).toBe(true);
  });

  it("'once' passes only before the first display", () => {
    expect(passesFrequency("w1", "once")).toBe(true);
    recordDisplay("w1");
    expect(passesFrequency("w1", "once")).toBe(false);
  });

  it("'once_per_session' passes until shown this session", () => {
    expect(passesFrequency("w1", "once_per_session")).toBe(true);
    recordDisplay("w1");
    expect(passesFrequency("w1", "once_per_session")).toBe(false);
  });

  it("'every_7_days' passes immediately after a fresh display but fails right after showing", () => {
    expect(passesFrequency("w1", "every_7_days")).toBe(true);
    recordDisplay("w1");
    expect(passesFrequency("w1", "every_7_days")).toBe(false);
  });

  it("'every_30_days' passes immediately after a fresh display but fails right after showing", () => {
    expect(passesFrequency("w1", "every_30_days")).toBe(true);
    recordDisplay("w1");
    expect(passesFrequency("w1", "every_30_days")).toBe(false);
  });
});

describe("passesPageViews", () => {
  it("passes when no minimum is set", () => {
    expect(passesPageViews(undefined)).toBe(true);
    expect(passesPageViews(0)).toBe(true);
  });

  it("requires at least the configured number of page views", () => {
    expect(passesPageViews(2)).toBe(false);
    incrementPageViews();
    expect(passesPageViews(2)).toBe(false);
    incrementPageViews();
    expect(passesPageViews(2)).toBe(true);
  });
});

describe("isEligible", () => {
  function widget(targeting: Widget["config"]["targeting"]): Widget {
    return {
      id: "w1",
      name: "Test widget",
      type: "rating",
      config: { targeting },
    };
  }

  it("is eligible when every rule passes", () => {
    expect(isEligible(widget({ frequency: "always" }))).toBe(true);
  });

  it("is not eligible once the frequency cap is hit", () => {
    const w = widget({ frequency: "once" });
    expect(isEligible(w)).toBe(true);
    recordDisplay(w.id);
    expect(isEligible(w)).toBe(false);
  });

  it("is not eligible when the URL pattern doesn't match", () => {
    expect(isEligible(widget({ urls: ["/definitely/not/the/current/url"] }))).toBe(false);
  });

  it("is not eligible when the page-view minimum isn't met", () => {
    expect(isEligible(widget({ minPageViews: 5 }))).toBe(false);
  });
});
