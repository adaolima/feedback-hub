# Vue

`@feedbackhub/vue` (`packages/vue`) wraps the vanilla SDK as a Vue 3 plugin plus a composable,
mirroring [react.md](react.md)'s provider/hook shape. See [sdk.md](sdk.md) for what each underlying
method does.

## Setup

```ts
import { createApp } from "vue";
import { createFeedbackHub } from "@feedbackhub/vue";
import App from "./App.vue";

const app = createApp(App);
app.use(
  createFeedbackHub({
    projectKey: "pk_...",
    sdkUrl: "https://your-api.example.com/sdk.js",
    apiBaseUrl: "https://your-api.example.com", // optional
    debug: false, // optional
  })
);
app.mount("#app");
```

Installing the plugin injects the `<script>` tag once (deduplicated via a `data-feedbackhub-sdk`
attribute), waits for it to load, and calls `init({ projectKey, apiBaseUrl, debug })`. It also
`provide()`s a client proxy that every component in the app can `inject`/`useFeedback()`.

## Usage

```vue
<script setup lang="ts">
import { useFeedback } from "@feedbackhub/vue";
const feedback = useFeedback();
</script>

<template>
  <button @click="feedback.open('NPS Survey')">Give feedback</button>
</template>
```

`useFeedback()` throws if called before the plugin is installed. The returned client proxies every
call to `window.FeedbackHub`, so it's safe to call before the underlying script has finished loading
— calls just silently no-op until then.

Available methods: `init`, `open`, `close`, `show`, `hide`, `identify`, `track`, `destroy`.
