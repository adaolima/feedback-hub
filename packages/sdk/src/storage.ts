const ANON_ID_KEY = "fh_anonymous_id";
const IDENTITY_KEY = "fh_identity";
const DISPLAY_STATE_PREFIX = "fh_display_";
const PAGE_VIEWS_KEY = "fh_page_views";

function safeStorage(): Storage | null {
  try {
    const testKey = "__fh_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function uuid(): string {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAnonymousId(): string {
  const storage = safeStorage();
  if (!storage) return uuid();
  let id = storage.getItem(ANON_ID_KEY);
  if (!id) {
    id = uuid();
    storage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  try {
    let id = window.sessionStorage.getItem("fh_session_id");
    if (!id) {
      id = uuid();
      window.sessionStorage.setItem("fh_session_id", id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function saveIdentity(identity: Record<string, unknown>): void {
  safeStorage()?.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function loadIdentity(): Record<string, unknown> | null {
  const raw = safeStorage()?.getItem(IDENTITY_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function incrementPageViews(): number {
  const storage = safeStorage();
  if (!storage) return 1;
  const count = parseInt(storage.getItem(PAGE_VIEWS_KEY) ?? "0", 10) + 1;
  storage.setItem(PAGE_VIEWS_KEY, String(count));
  return count;
}

export function getPageViews(): number {
  return parseInt(safeStorage()?.getItem(PAGE_VIEWS_KEY) ?? "0", 10);
}

interface DisplayState {
  lastShownAt: number;
  showCount: number;
}

export function getDisplayState(widgetId: string): DisplayState {
  const raw = safeStorage()?.getItem(DISPLAY_STATE_PREFIX + widgetId);
  if (!raw) return { lastShownAt: 0, showCount: 0 };
  return JSON.parse(raw);
}

export function hasShownThisSession(widgetId: string): boolean {
  try {
    return window.sessionStorage.getItem(DISPLAY_STATE_PREFIX + widgetId) === "1";
  } catch {
    return false;
  }
}

export function recordDisplay(widgetId: string): void {
  const state = getDisplayState(widgetId);
  state.lastShownAt = Date.now();
  state.showCount += 1;
  safeStorage()?.setItem(DISPLAY_STATE_PREFIX + widgetId, JSON.stringify(state));
  try {
    window.sessionStorage.setItem(DISPLAY_STATE_PREFIX + widgetId, "1");
  } catch {
    /* ignore */
  }
}
