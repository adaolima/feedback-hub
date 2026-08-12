# Getting Started

This walks through the full loop — from a clean checkout to seeing a real response land in the
dashboard — using the Docker Compose stack. It's the same flow validated in [TODO.md](../TODO.md)'s
"Definition of Done".

## 1. Start the stack

```bash
git clone <this-repo>
cd feedback-system
docker compose up --build
```

This builds and starts five containers:

| Service     | Purpose                                          | URL                     |
|-------------|---------------------------------------------------|--------------------------|
| `postgres`  | Database                                          | `localhost:5432`         |
| `redis`     | Reserved for future caching/rate-limit use         | `localhost:6379`         |
| `migrate`   | One-shot: applies migrations, then seeds demo data | (exits after running)    |
| `api`       | REST API + serves `/sdk.js`                        | http://localhost:4000    |
| `dashboard` | Next.js admin dashboard                            | http://localhost:3000    |
| `demo`      | Static site embedding the SDK against the live API | http://localhost:3001    |

Wait for the `migrate` container to log `Seed complete.` before using the dashboard — it prints the
seeded demo credentials and the demo project's public key.

## 2. Log in

Open http://localhost:3000 and log in with the seeded account:

```
email:    demo@feedbackhub.dev
password: password123
```

This account already owns an organisation and a project with four published widgets (rating, NPS,
thumbs, emoji reaction).

## 3. Explore the demo site

Open http://localhost:3001. It's a plain HTML page loading the FeedbackHub SDK against the real API
using the seeded project's public key. You'll see:

- Inline widgets rendered directly into the page.
- A floating "Feedback" button (NPS survey) that appears after a short delay.
- A bottom-bar emoji reaction widget.
- Buttons that call `FeedbackHub.open(...)` and `FeedbackHub.track(...)` programmatically.

Submit a response to any widget, then check the dashboard's **Responses** tab — it should appear
within a few seconds, along with updated numbers in **Analytics**.

## 4. Create your own project and widget

From the dashboard:

1. **Projects** → create a new project.
2. **Widgets** → create a widget, pick a type (rating, NPS, thumbs, emoji, text, choice, multiple
   choice, or a multi-question survey), configure appearance and targeting, then **Publish** it.
3. **API Keys** → copy the project's public key (`pk_...`) — this is what the SDK uses to identify
   the project. It's safe to embed client-side, unlike the secret key.
4. Embed the SDK on any page (see [sdk.md](sdk.md) for the full reference):

```html
<script>
  window.FeedbackHubConfig = { projectKey: "pk_..." , apiBaseUrl: "http://localhost:4000" };
</script>
<script src="http://localhost:4000/sdk.js" async></script>
```

## Local development without Docker

If you're actively developing (not just trying the product), see the root [README.md](../README.md)
for running each app individually with `npm run dev:*` against a Postgres instance of your choosing.

## Next steps

- [`sdk.md`](sdk.md) — full vanilla JS SDK API reference.
- [`react.md`](react.md), [`vue.md`](vue.md), [`angular.md`](angular.md) — framework wrappers.
- [`api.md`](api.md) — REST API summary.
- [`authentication.md`](authentication.md) — how admin auth and the public widget API differ.
- [`webhooks.md`](webhooks.md) — reacting to new responses outside the dashboard.
- [`deployment.md`](deployment.md) — running this in production.
