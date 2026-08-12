import { inject, type App, type InjectionKey } from "vue";

export interface FeedbackHubClient {
  init(options: { projectKey: string; apiBaseUrl?: string; debug?: boolean }): void;
  open(widgetIdOrName: string): void;
  close(widgetIdOrName?: string): void;
  show(widgetIdOrName: string): void;
  hide(widgetIdOrName: string): void;
  identify(identity: { userId?: string; email?: string; name?: string }): void;
  track(eventName: string, properties?: Record<string, unknown>): void;
  destroy(): void;
}

declare global {
  interface Window {
    FeedbackHub?: FeedbackHubClient;
  }
}

export interface FeedbackHubOptions {
  projectKey: string;
  sdkUrl?: string;
  apiBaseUrl?: string;
  debug?: boolean;
}

export const FeedbackHubKey: InjectionKey<FeedbackHubClient> = Symbol("FeedbackHub");

function createProxyClient(): FeedbackHubClient {
  return {
    init: (options) => window.FeedbackHub?.init(options),
    open: (id) => window.FeedbackHub?.open(id),
    close: (id) => window.FeedbackHub?.close(id),
    show: (id) => window.FeedbackHub?.show(id),
    hide: (id) => window.FeedbackHub?.hide(id),
    identify: (identity) => window.FeedbackHub?.identify(identity),
    track: (name, props) => window.FeedbackHub?.track(name, props),
    destroy: () => window.FeedbackHub?.destroy(),
  };
}

/**
 * Vue plugin that loads the FeedbackHub SDK script once and initialises it for the given project
 * key. Install with `app.use(createFeedbackHub({ projectKey: "pk_..." }))`, then read the client
 * anywhere via `useFeedback()`.
 */
export function createFeedbackHub(options: FeedbackHubOptions) {
  const { projectKey, sdkUrl = "https://feedback.example.com/sdk.js", apiBaseUrl, debug } = options;

  return {
    install(app: App) {
      app.provide(FeedbackHubKey, createProxyClient());

      function initialise() {
        window.FeedbackHub?.init({ projectKey, apiBaseUrl, debug });
      }

      if (window.FeedbackHub) {
        initialise();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>("script[data-feedbackhub-sdk]");
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = sdkUrl;
        script.async = true;
        script.setAttribute("data-feedbackhub-sdk", "true");
        document.head.appendChild(script);
      }
      script.addEventListener("load", initialise);
    },
  };
}

export function useFeedback(): FeedbackHubClient {
  const client = inject(FeedbackHubKey);
  if (!client) {
    throw new Error(
      "useFeedback() must be used after installing the FeedbackHub plugin via app.use(createFeedbackHub(options))"
    );
  }
  return client;
}
