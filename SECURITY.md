# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately via **[GitHub Security Advisories](../../security/advisories/new)** for
this repository, or by emailing **me@adaolima.com**. Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro is ideal)
- Any relevant logs, requests, or code references

You should receive an acknowledgement within a few days. We'll work with you to understand and
confirm the issue, and to agree on a disclosure timeline once a fix is available.

## Scope

This is a self-hosted platform: deployers are responsible for their own infrastructure hardening
(TLS termination, secret management, network isolation, DB backups). In-scope reports are ones
about the application itself, notably:

- Authentication/session handling (`apps/api/src/modules/auth`)
- Tenant isolation — any way to read or write another organisation's/project's data
  (`apps/api/src/middleware/tenant.ts` and any route that doesn't route through it)
- The public widget-facing API (`/api/v1/public/*`, `POST /api/v1/responses`) — anything reachable
  via a project's public key that shouldn't be
- The embeddable SDK (`packages/sdk`) — e.g. any way it could be used to break out of its Shadow DOM
  sandbox or execute arbitrary code on the host page
- SQL injection, XSS, CSRF, SSRF, or auth bypass anywhere in `apps/api` or `apps/dashboard`
- Webhook signature verification (`apps/api/src/modules/webhooks`)

## Supported versions

This project has not yet had a tagged release; security fixes are applied to the `main` branch.
Once versioned releases begin, this section will list which lines receive security patches.
