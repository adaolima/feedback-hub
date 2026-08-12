import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";

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

interface FeedbackHubProviderProps {
  projectKey: string;
  sdkUrl?: string;
  apiBaseUrl?: string;
  debug?: boolean;
  children: React.ReactNode;
}

const FeedbackHubContext = createContext<FeedbackHubClient | null>(null);

/** Loads the FeedbackHub SDK script once and initialises it for the given project key. */
export function FeedbackHubProvider({
  projectKey,
  sdkUrl = "https://feedback.example.com/sdk.js",
  apiBaseUrl,
  debug,
  children,
}: FeedbackHubProviderProps) {
  const clientRef = useRef<FeedbackHubClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    function initialise() {
      if (cancelled || !window.FeedbackHub) return;
      window.FeedbackHub.init({ projectKey, apiBaseUrl, debug });
      clientRef.current = window.FeedbackHub;
    }

    if (window.FeedbackHub) {
      initialise();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-feedbackhub-sdk]`);
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = sdkUrl;
        script.async = true;
        script.setAttribute("data-feedbackhub-sdk", "true");
        document.head.appendChild(script);
      }
      script.addEventListener("load", initialise);
      return () => script.removeEventListener("load", initialise);
    }

    return () => {
      cancelled = true;
    };
  }, [projectKey, sdkUrl, apiBaseUrl, debug]);

  const proxy = useMemo<FeedbackHubClient>(
    () => ({
      init: (options) => window.FeedbackHub?.init(options),
      open: (id) => window.FeedbackHub?.open(id),
      close: (id) => window.FeedbackHub?.close(id),
      show: (id) => window.FeedbackHub?.show(id),
      hide: (id) => window.FeedbackHub?.hide(id),
      identify: (identity) => window.FeedbackHub?.identify(identity),
      track: (name, props) => window.FeedbackHub?.track(name, props),
      destroy: () => window.FeedbackHub?.destroy(),
    }),
    []
  );

  return <FeedbackHubContext.Provider value={proxy}>{children}</FeedbackHubContext.Provider>;
}

export function useFeedback(): FeedbackHubClient {
  const ctx = useContext(FeedbackHubContext);
  if (!ctx) {
    throw new Error("useFeedback() must be used within a <FeedbackHubProvider>");
  }
  return ctx;
}
