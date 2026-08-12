import { Inject, Injectable, InjectionToken, ModuleWithProviders, NgModule } from "@angular/core";

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

export const FEEDBACKHUB_OPTIONS = new InjectionToken<FeedbackHubOptions>("FEEDBACKHUB_OPTIONS");

/**
 * Loads the FeedbackHub SDK script once and initialises it for the configured project key. Every
 * method proxies to `window.FeedbackHub`, so it's safe to call before the script has finished
 * loading. Provided via `FeedbackHubModule.forRoot(options)`.
 */
@Injectable()
export class FeedbackHubService implements FeedbackHubClient {
  constructor(@Inject(FEEDBACKHUB_OPTIONS) private options: FeedbackHubOptions) {
    this.loadScript();
  }

  private loadScript(): void {
    const { sdkUrl = "https://feedback.example.com/sdk.js", projectKey, apiBaseUrl, debug } = this.options;

    const initialise = () => {
      window.FeedbackHub?.init({ projectKey, apiBaseUrl, debug });
    };

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
  }

  init(options: { projectKey: string; apiBaseUrl?: string; debug?: boolean }): void {
    window.FeedbackHub?.init(options);
  }

  open(widgetIdOrName: string): void {
    window.FeedbackHub?.open(widgetIdOrName);
  }

  close(widgetIdOrName?: string): void {
    window.FeedbackHub?.close(widgetIdOrName);
  }

  show(widgetIdOrName: string): void {
    window.FeedbackHub?.show(widgetIdOrName);
  }

  hide(widgetIdOrName: string): void {
    window.FeedbackHub?.hide(widgetIdOrName);
  }

  identify(identity: { userId?: string; email?: string; name?: string }): void {
    window.FeedbackHub?.identify(identity);
  }

  track(eventName: string, properties: Record<string, unknown> = {}): void {
    window.FeedbackHub?.track(eventName, properties);
  }

  destroy(): void {
    window.FeedbackHub?.destroy();
  }
}

@NgModule()
export class FeedbackHubModule {
  static forRoot(options: FeedbackHubOptions): ModuleWithProviders<FeedbackHubModule> {
    return {
      ngModule: FeedbackHubModule,
      providers: [{ provide: FEEDBACKHUB_OPTIONS, useValue: options }, FeedbackHubService],
    };
  }
}
