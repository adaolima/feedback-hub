# JavaScript SDK

`packages/sdk` is the framework-independent embeddable SDK. It's bundled with esbuild to a single
file, `dist/sdk.js`, which the API serves directly at `/sdk.js` — there's no separate CDN or build
step for consumers.

**Design contract: the SDK must never break the host page.** Every public method and network call
is wrapped in `try/catch` and fails silently by default (or via `console.warn` when `debug: true`).
If the API is unreachable, widgets simply don't render — nothing throws into your page.

## Installing

```html
<script>
  window.FeedbackHubConfig = {
    projectKey: "pk_...",        // required — a project's public key
    apiBaseUrl: "https://your-api.example.com", // optional — inferred from the script's own origin if omitted
    debug: false,                 // optional — logs warnings to the console on failure
  };
</script>
<script src="https://your-api.example.com/sdk.js" async></script>
```

Setting `window.FeedbackHubConfig` before the script loads triggers `init()` automatically. You can
also call `init()` yourself at any time (idempotent — a second call is a no-op):

```js
window.FeedbackHub.init({ projectKey: "pk_..." });
```

## Methods

All methods hang off the global `FeedbackHub` object (`window.FeedbackHub`).

| Method                                        | Description                                                                 |
|-------------------------------------------------|-------------------------------------------------------------------------------|
| `init(options)`                                 | Loads the project's widget config and starts auto-display logic. Call once.  |
| `open(widgetIdOrName)`                          | Renders a widget immediately, matched by its ID or exact name.               |
| `close(widgetIdOrName?)`                        | Unmounts a specific widget, or all currently-mounted widgets if omitted.     |
| `show(widgetIdOrName)`                          | Alias for `open()`.                                                          |
| `hide(widgetIdOrName)`                          | Alias for `close()`.                                                         |
| `identify({ userId?, email?, name? })`          | Attaches identity to the current visitor; persisted to `localStorage` and sent with future responses/events. |
| `track(eventName, properties?)`                 | Records a custom event and checks whether it should trigger any event-targeted widgets. |
| `destroy()`                                     | Unmounts everything and resets SDK state, including the floating button.     |

## Embedding modes

Set per-widget in the dashboard's widget builder (`config.displayMode`):

- **`inline`** — renders into `<div data-feedback-widget="Widget Name"></div>` wherever that element
  exists on the page. If no matching container exists, the widget simply doesn't render there.
- **`floating`** — a floating button appears (position configurable: `bottom-right`, `bottom-left`,
  `top-right`, `top-left`, `center`); clicking it opens the widget.
- **`bottom_bar`** — renders as a bar pinned to the bottom of the viewport once targeting conditions
  are met.
- **`modal`** / **`triggered`** — never renders automatically; only appears via `FeedbackHub.open()`
  or a matching `track()` event trigger.

Every widget renders inside a Shadow DOM root, so host page CSS never leaks in and widget CSS never
leaks out.

## Targeting

Configured per-widget under `config.targeting`:

| Field                | Type                                                              | Behavior                                              |
|------------------------|--------------------------------------------------------------------|----------------------------------------------------------|
| `urls`                | `string[]`                                                          | Widget only shows if `location.href` contains one of these substrings. Omit to match all pages. |
| `delaySeconds`        | `number`                                                             | Delay before a `bottom_bar` widget auto-displays.        |
| `minPageViews`        | `number`                                                             | Minimum page views (tracked in `localStorage`) before eligible. |
| `events`              | `string[]`                                                           | Widget opens when `track()` is called with any of these event names. |
| `exitIntent`          | `boolean`                                                            | Opens the widget when the mouse leaves the top of the viewport. |
| `frequency`           | `"always" \| "once" \| "once_per_session" \| "every_7_days" \| "every_30_days"` | Caps how often a widget re-displays to the same browser (via `localStorage`/`sessionStorage`). |
| `returningUsersOnly`  | `boolean`                                                            | Stored in config; not yet enforced client-side — see [TODO.md](../TODO.md). |
| `identifiedOnly`      | `boolean`                                                            | Stored in config; not yet enforced client-side — see [TODO.md](../TODO.md). |

## Question / widget types

`QuestionType` is `rating | nps | thumbs | emoji | text | choice | multiple_choice`. A `widget` is
either a single question type directly, or `survey` — a multi-question flow with AND-only
conditional logic (`ConditionalLogic.all`, see `packages/shared`). Question `config` and response
`value` are stored as JSONB, so adding a new question type is a matter of extending the
`QuestionType` union plus a rendering case in `packages/sdk/src/render.ts` — not a database
migration.

## Identity & anonymous tracking

- An anonymous ID is generated and persisted per-browser (`localStorage`) on first load.
- A session ID is generated per browser tab session (`sessionStorage`).
- `identify()` merges into a persisted identity object and is attached to future response
  submissions and tracked events, but never overwrites the anonymous/session IDs.

## Framework wrappers

If you're in React, Vue, or Angular, use the matching wrapper package instead of loading the script
tag yourself — see [react.md](react.md), [vue.md](vue.md), [angular.md](angular.md). They all load
the same `sdk.js` and proxy to the same `window.FeedbackHub` instance described above.
