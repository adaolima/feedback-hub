import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();
const rand = () => Math.random().toString(36).slice(2, 10);

async function registerAndLogin(email: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "SuperSecret123!",
    name: "Test User",
  });
  return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
}

describe("auth", () => {
  it("registers, logs in, and reads the current user", async () => {
    const email = `user-${rand()}@example.com`;
    const { accessToken } = await registerAndLogin(email);
    expect(accessToken).toBeTruthy();

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejects invalid credentials", async () => {
    const email = `user-${rand()}@example.com`;
    await registerAndLogin(email);
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects requests without an access token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("organisations, projects and tenant isolation", () => {
  it("lets a user create an org + project, but blocks other users from accessing it", async () => {
    const { accessToken: tokenA } = await registerAndLogin(`owner-${rand()}@example.com`);
    const { accessToken: tokenB } = await registerAndLogin(`outsider-${rand()}@example.com`);

    const org = await request(app)
      .post("/api/v1/organisations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: `Acme ${rand()}` });
    expect(org.status).toBe(201);
    const organisationId = org.body.organisation.id;

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ organisationId, name: "Website" });
    expect(project.status).toBe(201);
    const projectId = project.body.project.id;

    // Owner can read it back.
    const ownerRead = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(ownerRead.status).toBe(200);

    // A user with no membership in this org must be forbidden.
    const outsiderRead = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(outsiderRead.status).toBe(403);
  });
});

describe("widgets, publishing, and public responses", () => {
  async function setupProject() {
    const { accessToken } = await registerAndLogin(`admin-${rand()}@example.com`);
    const org = await request(app)
      .post("/api/v1/organisations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Org ${rand()}` });
    const organisationId = org.body.organisation.id;

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ organisationId, name: "Demo" });
    const projectId = project.body.project.id;

    const apiKey = await request(app)
      .post("/api/v1/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ projectId, name: "Public Key", type: "public" });
    const projectKey = apiKey.body.apiKey.key_value;

    return { accessToken, organisationId, projectId, projectKey };
  }

  it("creates a widget, publishes it, then accepts a public response and reflects it in analytics", async () => {
    const { accessToken, projectId, projectKey } = await setupProject();

    const widget = await request(app)
      .post("/api/v1/widgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ projectId, name: "NPS", type: "nps", config: { displayMode: "inline" } });
    expect(widget.status).toBe(201);
    const widgetId = widget.body.widget.id;

    // Unpublished widgets must not accept public responses.
    const rejected = await request(app)
      .post("/api/v1/responses")
      .send({ projectKey, widgetId, npsScore: 9 });
    expect(rejected.status).toBe(404);

    const publish = await request(app)
      .post(`/api/v1/widgets/${widgetId}/publish`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(publish.status).toBe(200);
    expect(publish.body.widget.status).toBe("published");

    const submitted = await request(app)
      .post("/api/v1/responses")
      .send({ projectKey, widgetId, npsScore: 9, feedbackText: "Great product" });
    expect(submitted.status).toBe(201);

    const list = await request(app)
      .get(`/api/v1/responses?projectId=${projectId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(1);

    const analytics = await request(app)
      .get(`/api/v1/analytics?projectId=${projectId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.nps.responses).toBe(1);
    expect(analytics.body.nps.promoters).toBe(1);
  });

  it("rejects an invalid or revoked project key", async () => {
    const { projectId } = await setupProject();
    const res = await request(app)
      .post("/api/v1/responses")
      .send({ projectKey: "pk_does_not_exist", widgetId: projectId, npsScore: 5 });
    expect(res.status).toBe(401);
  });
});

describe("api keys", () => {
  it("shows the secret only once and hides it afterwards", async () => {
    const { accessToken } = await registerAndLogin(`keys-${rand()}@example.com`);
    const org = await request(app)
      .post("/api/v1/organisations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Org ${rand()}` });
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ organisationId: org.body.organisation.id, name: "P" });
    const projectId = project.body.project.id;

    const created = await request(app)
      .post("/api/v1/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ projectId, name: "Secret Key", type: "secret" });
    expect(created.status).toBe(201);
    expect(created.body.apiKey.secret).toBeTruthy();

    const list = await request(app)
      .get(`/api/v1/api-keys?projectId=${projectId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.apiKeys[0].secret).toBeUndefined();
    expect(list.body.apiKeys[0].key_hash).toBeUndefined();
  });
});

describe("webhooks", () => {
  it("creates a webhook subscription scoped to a project", async () => {
    const { accessToken } = await registerAndLogin(`hooks-${rand()}@example.com`);
    const org = await request(app)
      .post("/api/v1/organisations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Org ${rand()}` });
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ organisationId: org.body.organisation.id, name: "P" });
    const projectId = project.body.project.id;

    const webhook = await request(app)
      .post("/api/v1/webhooks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ projectId, url: "https://example.com/webhook", events: ["response.created"] });
    expect(webhook.status).toBe(201);
    expect(webhook.body.webhook.secret).toBeTruthy();
  });
});

describe("health", () => {
  it("reports healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
