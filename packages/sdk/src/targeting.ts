import { Widget } from "./types";
import { getDisplayState, getPageViews, hasShownThisSession } from "./storage";

export function matchesUrl(patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  const current = window.location.href;
  return patterns.some((pattern) => current.includes(pattern));
}

export function passesFrequency(widgetId: string, frequency: string | undefined): boolean {
  switch (frequency) {
    case "once": {
      const state = getDisplayState(widgetId);
      return state.showCount === 0;
    }
    case "once_per_session":
      return !hasShownThisSession(widgetId);
    case "every_7_days":
    case "every_30_days": {
      const days = frequency === "every_7_days" ? 7 : 30;
      const state = getDisplayState(widgetId);
      if (state.lastShownAt === 0) return true;
      return Date.now() - state.lastShownAt > days * 24 * 60 * 60 * 1000;
    }
    case "always":
    default:
      return true;
  }
}

export function passesPageViews(minPageViews: number | undefined): boolean {
  if (!minPageViews) return true;
  return getPageViews() >= minPageViews;
}

/** Evaluates whether a widget is eligible to display right now, excluding delay/event triggers (handled by the caller). */
export function isEligible(widget: Widget): boolean {
  const targeting = widget.config?.targeting ?? {};
  return (
    matchesUrl(targeting.urls) &&
    passesFrequency(widget.id, targeting.frequency) &&
    passesPageViews(targeting.minPageViews)
  );
}
