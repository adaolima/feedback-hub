# React

`@feedbackhub/react` (`packages/react`) is a thin wrapper around the vanilla SDK: a provider that
loads `sdk.js` once and initialises it, plus a hook exposing the same client methods described in
[sdk.md](sdk.md).

## Setup

```tsx
import { FeedbackHubProvider } from "@feedbackhub/react";

function App() {
  return (
    <FeedbackHubProvider
      projectKey="pk_..."
      sdkUrl="https://your-api.example.com/sdk.js"
      apiBaseUrl="https://your-api.example.com" // optional, inferred from sdkUrl's origin if omitted
      debug={false}
    >
      <YourApp />
    </FeedbackHubProvider>
  );
}
```

The provider injects the `<script>` tag (deduplicated via a `data-feedbackhub-sdk` attribute, so
mounting multiple providers or remounting doesn't double-load it), waits for it to load, and calls
`init({ projectKey, apiBaseUrl, debug })`.

## Usage

```tsx
import { useFeedback } from "@feedbackhub/react";

function FeedbackButton() {
  const feedback = useFeedback();
  return <button onClick={() => feedback.open("NPS Survey")}>Give feedback</button>;
}
```

`useFeedback()` throws if called outside a `<FeedbackHubProvider>`. The returned client proxies
every call to `window.FeedbackHub`, so it's safe to call before the underlying script has finished
loading — calls just silently no-op until then, consistent with the SDK's fail-silent design.

Available methods: `init`, `open`, `close`, `show`, `hide`, `identify`, `track`, `destroy` — see
[sdk.md](sdk.md) for what each does.

## Next.js

`packages/react` has no Next.js-specific code, but two things matter in the App Router:

- `FeedbackHubProvider` calls `useEffect`, so any component tree using it (or `useFeedback()`) needs
  `"use client"` at the top of the file.
- Render `<FeedbackHubProvider>` as high as makes sense for your layout (e.g. in a client component
  wrapping `{children}` in `app/layout.tsx`), so `useFeedback()` is available anywhere below it.

A dedicated App Router example is tracked in [TODO.md](../TODO.md).
