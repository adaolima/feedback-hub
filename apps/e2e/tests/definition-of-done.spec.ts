import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

const API_URL = "http://localhost:4000";

/**
 * Serves a one-off HTML fixture from a real loopback HTTP origin. Chrome's Private Network Access
 * checks treat a `null` origin (e.g. `about:blank` + page.setContent) as untrusted and block it from
 * fetching loopback resources like our locally-running API - a real `http://127.0.0.1` origin avoids
 * that entirely, and also better matches how the SDK is actually embedded on a real customer site.
 */
async function serveFixture(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Walks the full Definition of Done flow end-to-end, through the real UI and a real embedded SDK:
 * register -> org -> project -> widget -> publish -> embed -> respond -> view analytics.
 */
test("register, onboard, embed the SDK, submit a response, and see it in analytics", async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-${unique}@example.com`;
  const password = "SuperSecret123!";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1: organisation.
  await page.getByLabel("Organisation name").fill(`E2E Org ${unique}`);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: project - the default name ("My Website") is fine.
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: team - optional, skip it.
  await page.getByRole("button", { name: "Skip" }).click();

  // Step 4: widget - defaults are "Website Feedback" / rating / inline / publish immediately.
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: finish - pull the public key out of the embed snippet shown here.
  await expect(page.getByRole("heading", { name: /all set/i })).toBeVisible();
  const snippet = await page.locator(".code-snippet").innerText();
  const publicKeyMatch = snippet.match(/projectKey:\s*"([^"]+)"/);
  expect(publicKeyMatch, `expected a projectKey in the embed snippet, got:\n${snippet}`).not.toBeNull();
  const publicKey = publicKeyMatch![1];

  await page.getByRole("button", { name: "Go to Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Embed the real SDK on a standalone page (not the dashboard's own origin) and submit a rating
  // through it, end to end: browser -> SDK -> public API -> Postgres.
  const fixture = await serveFixture(`<!doctype html>
<html>
  <body>
    <div data-feedback-widget="Website Feedback"></div>
    <script>
      window.FeedbackHubConfig = { projectKey: "${publicKey}", apiBaseUrl: "${API_URL}" };
    </script>
    <script src="${API_URL}/sdk.js"></script>
  </body>
</html>`);

  try {
    await page.goto(fixture.url);

    const widgetHost = page.locator('[data-feedback-widget="Website Feedback"] [data-feedbackhub-widget]');
    await expect(widgetHost).toBeVisible();
    const stars = widgetHost.locator(".fh-star-btn");
    await expect(stars).toHaveCount(5);
    await stars.nth(3).click(); // a 4-star rating
    await expect(widgetHost.locator(".fh-thanks")).toBeVisible();
  } finally {
    await fixture.close();
  }

  // Back in the dashboard: the response should be visible in the Responses list. A fresh navigation
  // here re-authenticates from the refresh cookie and re-loads the org/project workspace context
  // before the responses table itself can load, so give this one a longer timeout.
  await page.goto("/responses");
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("No responses yet.")).not.toBeVisible();

  // ...and reflected in the Analytics aggregate. Match the "Responses" metric-label exactly - a
  // substring filter would also match the "N responses" captions on the promoter/passive/detractor
  // cards further down the page.
  await page.goto("/analytics");
  const responsesCard = page.locator(".card").filter({ has: page.getByText("Responses", { exact: true }) });
  await expect(responsesCard.locator(".metric-value")).toHaveText("1");
});
