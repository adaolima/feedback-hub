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

## Next.js (App Router)

`packages/react` has no Next.js-specific code — two things matter in the App Router:

- `FeedbackHubProvider` calls `useEffect`, so any file using it (or `useFeedback()`) needs
  `"use client"` at the top.
- `app/layout.tsx` is usually a Server Component (it's where `metadata` exports live), so don't put
  `"use client"` on it directly — instead push the provider into its own small client component and
  import that into the layout.

```tsx
// app/providers.tsx
"use client";

import { FeedbackHubProvider } from "@feedbackhub/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackHubProvider
      projectKey={process.env.NEXT_PUBLIC_FEEDBACKHUB_PROJECT_KEY!}
      sdkUrl={`${process.env.NEXT_PUBLIC_FEEDBACKHUB_API_URL}/sdk.js`}
      apiBaseUrl={process.env.NEXT_PUBLIC_FEEDBACKHUB_API_URL}
    >
      {children}
    </FeedbackHubProvider>
  );
}
```

```tsx
// app/layout.tsx — stays a Server Component; metadata etc. still work here
import { Providers } from "./providers";

export const metadata = { title: "Your App" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// components/feedback-button.tsx — any client component below the provider can use the hook
"use client";

import { useFeedback } from "@feedbackhub/react";

export function FeedbackButton() {
  const feedback = useFeedback();
  return <button onClick={() => feedback.open("NPS Survey")}>Give feedback</button>;
}
```

Project key and API URL must come from `NEXT_PUBLIC_*` env vars (Next.js only inlines env vars with
that prefix into client bundles) — set them in `.env.local`:

```
NEXT_PUBLIC_FEEDBACKHUB_PROJECT_KEY=pk_...
NEXT_PUBLIC_FEEDBACKHUB_API_URL=https://your-api.example.com
```

`FeedbackButton` (and anything else calling `useFeedback()`) can only be rendered from Server
Components, not imported and called directly inside one — the `"use client"` boundary on the file
itself handles this correctly as shown above.
