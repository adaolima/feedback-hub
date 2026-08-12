import { ApiClient } from "./api";
import { getOrCreateFloatingContainer, findInlineContainer, createFloatingButton } from "./containers";
import { mountWidget, MountedWidget } from "./render";
import { getAnonymousId, getSessionId, saveIdentity, loadIdentity, incrementPageViews, recordDisplay } from "./storage";
import { isEligible } from "./targeting";
import { FeedbackHubOptions, Identity, RemoteConfig, Widget } from "./types";

/**
 * FeedbackHub browser SDK. Designed to fail gracefully: any error here must never
 * break the host page. All public methods are wrapped in try/catch.
 */
class FeedbackHubClient {
  private api: ApiClient | null = null;
  private config: RemoteConfig | null = null;
  private identity: Identity = {};
  private mounted = new Map<string, MountedWidget>();
  private initialized = false;
  private debug = false;
  private eventListenerAttached = false;

  init(options: FeedbackHubOptions): void {
    try {
      if (this.initialized) return;
      if (!options?.projectKey) {
        this.warn("init() requires a projectKey");
        return;
      }
      this.debug = Boolean(options.debug);
      const baseUrl = options.apiBaseUrl ?? this.inferApiBaseUrl();
      this.api = new ApiClient(baseUrl, options.projectKey);
      this.identity = loadIdentity() ?? {};
      this.initialized = true;

      incrementPageViews();
      this.loadConfigAndRender();
      this.attachGlobalListeners();
    } catch (err) {
      this.warn("init() failed", err);
    }
  }

  identify(identity: Identity): void {
    try {
      this.identity = { ...this.identity, ...identity };
      saveIdentity(this.identity);
    } catch (err) {
      this.warn("identify() failed", err);
    }
  }

  track(eventName: string, properties: Record<string, unknown> = {}): void {
    try {
      if (!this.api) return this.warn("track() called before init()");
      void this.api.trackEvent(eventName, properties, this.identityIds());
      this.checkEventTriggers(eventName);
    } catch (err) {
      this.warn("track() failed", err);
    }
  }

  open(widgetIdOrName: string): void {
    try {
      const widget = this.findWidget(widgetIdOrName);
      if (!widget) return this.warn(`No widget found for "${widgetIdOrName}"`);
      this.renderWidget(widget, true);
    } catch (err) {
      this.warn("open() failed", err);
    }
  }

  close(widgetIdOrName?: string): void {
    try {
      if (widgetIdOrName) {
        const widget = this.findWidget(widgetIdOrName);
        if (widget) this.unmount(widget.id);
        return;
      }
      for (const id of Array.from(this.mounted.keys())) this.unmount(id);
    } catch (err) {
      this.warn("close() failed", err);
    }
  }

  show(widgetIdOrName: string): void {
    this.open(widgetIdOrName);
  }

  hide(widgetIdOrName: string): void {
    this.close(widgetIdOrName);
  }

  destroy(): void {
    try {
      this.close();
      document.getElementById("fh-floating-button")?.remove();
      this.initialized = false;
      this.api = null;
      this.config = null;
    } catch (err) {
      this.warn("destroy() failed", err);
    }
  }

  private async loadConfigAndRender() {
    if (!this.api) return;
    const config = await this.api.getConfig();
    if (!config) return this.warn("Could not load FeedbackHub configuration");
    this.config = config;

    for (const widget of config.widgets) {
      const mode = widget.config?.displayMode ?? "inline";
      if (mode === "inline") {
        this.tryRenderInline(widget);
      } else if (mode === "floating") {
        this.scheduleFloating(widget);
      } else if (mode === "bottom_bar") {
        this.scheduleAutoDisplay(widget);
      }
      // "modal" and "triggered" widgets only render via explicit open()/track() calls.
    }
  }

  private tryRenderInline(widget: Widget) {
    const container = findInlineContainer(widget.id, widget.name);
    if (!container || !isEligible(widget)) return;
    this.renderInto(widget, container);
  }

  private scheduleFloating(widget: Widget) {
    if (!isEligible(widget)) return;
    const position = widget.config?.appearance?.position ?? "bottom-right";
    createFloatingButton(() => this.renderWidget(widget, true), position);
  }

  private scheduleAutoDisplay(widget: Widget) {
    if (!isEligible(widget)) return;
    const delay = (widget.config?.targeting?.delaySeconds ?? 0) * 1000;
    window.setTimeout(() => this.renderWidget(widget, true), delay);
  }

  private renderWidget(widget: Widget, floating: boolean) {
    if (this.mounted.has(widget.id)) return;
    const mode = widget.config?.displayMode ?? "inline";
    const container =
      mode === "inline"
        ? findInlineContainer(widget.id, widget.name)
        : getOrCreateFloatingContainer(mode, widget.config?.appearance?.position);
    if (!container) return this.warn("No container available to render widget");
    this.renderInto(widget, container, floating);
  }

  private renderInto(widget: Widget, container: HTMLElement, closable = false) {
    recordDisplay(widget.id);

    const mounted = mountWidget(
      widget,
      container,
      async (payload) => {
        if (!this.api) return;
        await this.api.submitResponse({
          widgetId: widget.id,
          surveyId: widget.survey?.id,
          anonymousId: getAnonymousId(),
          sessionId: getSessionId(),
          userId: this.identity.userId,
          rating: payload.rating,
          npsScore: payload.npsScore,
          feedbackText: payload.feedbackText,
          answers: payload.answers ?? [],
          pageUrl: window.location.href,
          pageTitle: document.title,
          referrer: document.referrer,
        });
      },
      closable ? () => this.unmount(widget.id) : undefined
    );
    this.mounted.set(widget.id, mounted);
  }

  private unmount(widgetId: string) {
    this.mounted.get(widgetId)?.destroy();
    this.mounted.delete(widgetId);
  }

  private findWidget(idOrName: string): Widget | undefined {
    return this.config?.widgets.find((w) => w.id === idOrName || w.name === idOrName);
  }

  private checkEventTriggers(eventName: string) {
    if (!this.config) return;
    for (const widget of this.config.widgets) {
      const events = widget.config?.targeting?.events ?? [];
      if (events.includes(eventName) && isEligible(widget)) {
        this.renderWidget(widget, true);
      }
    }
  }

  private attachGlobalListeners() {
    if (this.eventListenerAttached) return;
    this.eventListenerAttached = true;
    document.addEventListener("mouseleave", (e) => {
      if (e.clientY > 0 || !this.config) return;
      for (const widget of this.config.widgets) {
        if (widget.config?.targeting?.exitIntent && isEligible(widget)) {
          this.renderWidget(widget, true);
        }
      }
    });
  }

  private identityIds() {
    return { anonymousId: getAnonymousId(), sessionId: getSessionId(), userId: this.identity.userId };
  }

  private inferApiBaseUrl(): string {
    try {
      const script = document.currentScript as HTMLScriptElement | null;
      if (script?.src) return new URL(script.src).origin;
    } catch {
      /* ignore */
    }
    return "";
  }

  private warn(...args: unknown[]) {
    if (this.debug) console.warn("[FeedbackHub]", ...args);
  }
}

declare global {
  interface Window {
    FeedbackHub: FeedbackHubClient;
    FeedbackHubConfig?: FeedbackHubOptions;
  }
}

const instance = new FeedbackHubClient();

if (typeof window !== "undefined") {
  window.FeedbackHub = instance;
  if (window.FeedbackHubConfig) {
    instance.init(window.FeedbackHubConfig);
  }
}

export default instance;
