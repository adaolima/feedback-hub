import { RemoteConfig } from "./types";

export class ApiClient {
  constructor(private baseUrl: string, private projectKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Project-Key": this.projectKey,
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      // The host website must keep working even if the FeedbackHub API is unreachable.
      return null;
    }
  }

  async getConfig(): Promise<RemoteConfig | null> {
    return this.request<RemoteConfig>(`/api/v1/public/config?projectKey=${encodeURIComponent(this.projectKey)}`);
  }

  async submitResponse(body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/api/v1/responses`, {
      method: "POST",
      body: JSON.stringify({ ...body, projectKey: this.projectKey }),
    });
  }

  async trackEvent(name: string, properties: Record<string, unknown>, ids: Record<string, unknown>): Promise<void> {
    await this.request(`/api/v1/public/events`, {
      method: "POST",
      body: JSON.stringify({ projectKey: this.projectKey, name, properties, ...ids }),
    });
  }
}
