# Contributing to FeedbackHub

Thanks for considering a contribution. This document covers the practical steps for getting a
change merged. For the "why" behind the architecture, read [PLAN.md](PLAN.md); for what's known to
be missing or half-done, read [TODO.md](TODO.md); for repo conventions AI coding agents (and
humans) should follow, read [CLAUDE.md](CLAUDE.md).

## Before you start

- For anything beyond a small fix, open an issue first to discuss the approach. It saves everyone
  time if a design disagreement surfaces before the PR, not after.
- Check [TODO.md](TODO.md) and existing issues/PRs so you're not duplicating in-flight work.

## Development setup

```bash
npm install                              # install all workspaces from repo root
cp .env.example apps/api/.env            # then edit DATABASE_URL etc. as needed
docker compose up postgres redis         # or point DATABASE_URL at your own Postgres
npm run migrate --workspace apps/api     # apply DB migrations
npm run seed --workspace apps/api        # seed demo org/project/widgets/responses
npm run build:sdk                        # bundle packages/sdk -> dist/sdk.js

npm run dev:api                          # API dev server, :4000
npm run dev:dashboard                    # Next.js dashboard, :3000
npm run dev:demo                         # demo static server, :3001
```

Run the backend test suite before opening a PR that touches `apps/api`:

```bash
npm run test:api
```

It needs a live, reachable Postgres (`docker compose up postgres` is the easiest way) and applies
migrations automatically.

## Making changes

Follow the conventions in [CLAUDE.md](CLAUDE.md) — they apply to human contributors too. In short:

- **No ORM.** Raw `pg` with parameterised queries only (`$1, $2, ...`). Never string-concatenate
  user input into SQL.
- **New migrations only.** Add a new numbered `.sql` file in `database/migrations/`; never edit one
  that's already been applied.
- **Tenant isolation is mandatory.** Any project/organisation-scoped route must go through the
  `requireProjectPermission` / `requireProjectMembership` / `requireOrgPermission` /
  `requireOrgMembership` middleware in `apps/api/src/middleware/tenant.ts`.
- **Public vs admin API boundary.** Routes under `/api/v1/public/*` and `POST /api/v1/responses` are
  authenticated by project public key, not a user session — never gate them behind `requireAuth`,
  and never expose secret keys to them.
- **The SDK must never break the host page.** Every public SDK method and network call is wrapped in
  try/catch and fails silently (or via `console.warn` with `debug: true`).
- If you change `packages/sdk`, rebuild it (`npm run build:sdk`) before testing against the API or
  demo site — the API serves the compiled `dist/sdk.js`, not the TypeScript source.
- Adding a question/widget type touches `packages/shared` (the `QuestionType` union),
  `packages/sdk/src/render.ts` (rendering + validation), and the dashboard's builder — not a
  migration, since `config`/`value` are JSONB.

## Commit style

Write commit subjects as a plain-English statement of what changed and why it matters, not a log of
file operations — e.g. `Fix choice/multiple_choice survey questions end-to-end` rather than
`update render.ts`. Keep the subject line under ~70 characters; add a body if the change needs
context a reviewer wouldn't otherwise have.

## Pull requests

- Keep PRs focused — one logical change per PR is easier to review and easier to revert if needed.
- Update relevant docs (`README.md`, `docs/*.md`, `TODO.md`) in the same PR as the code change.
- Make sure `npm run test:api` passes for backend changes. There is no frontend/SDK test suite yet
  (see [TODO.md](TODO.md)) — manually exercise the change (dashboard UI or `apps/demo`) and describe
  how you tested it in the PR description.
- CI must be green before merge.

## Reporting bugs / requesting features

Use the issue templates under **New Issue**. Include repro steps, expected vs. actual behaviour, and
relevant logs/screenshots for bugs.

## Security issues

Do not open a public issue for a security vulnerability — see [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful; disagreements about
code are fine, personal attacks aren't.

## License

By contributing, you agree that your contributions will be licensed under the project's
[MIT License](LICENSE).
