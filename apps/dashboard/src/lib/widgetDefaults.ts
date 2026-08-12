import { API_URL } from "./api";

export const WIDGET_TYPES = ["rating", "nps", "thumbs", "emoji", "text", "choice", "multiple_choice", "survey"];
export const DISPLAY_MODES = ["inline", "floating", "bottom_bar", "modal", "triggered"];
export const PRESETS = ["minimal", "modern", "rounded", "corporate", "dark", "glass"];

export function defaultQuestionConfig(type: string): Record<string, any> {
  switch (type) {
    case "rating":
      return { type: "rating", min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" };
    case "nps":
      return { type: "nps" };
    case "thumbs":
      return { type: "thumbs", question: "Was this helpful?" };
    case "emoji":
      return { type: "emoji", question: "How was your experience?", emojis: ["\u{1F621}", "\u{1F61E}", "\u{1F610}", "\u{1F642}", "\u{1F60D}"] };
    case "text":
      return { type: "text", long: false, question: "What do you think?" };
    case "choice":
    case "multiple_choice":
      return {
        type,
        question: "Why did you visit this page?",
        multiple: type === "multiple_choice",
        allowOther: false,
        options: [
          { id: "1", label: "Learn more", value: "learn_more" },
          { id: "2", label: "Purchase", value: "purchase" },
          { id: "3", label: "Get support", value: "support" },
        ],
      };
    default:
      return {};
  }
}

export type EmbedFramework = "vanilla" | "react" | "vue" | "angular";

export function buildEmbedSnippet(publicKey: string, widgetId: string): string {
  return `<script>
  window.FeedbackHubConfig = { projectKey: "${publicKey}" };
</script>
<script async src="${API_URL}/sdk.js"></script>

<!-- For an inline widget, add a container with this id: -->
<div id="feedback-widget-${widgetId}"></div>

<!-- Or trigger it manually from anywhere: -->
<script>FeedbackHub.open("${widgetId}");</script>`;
}

export function buildReactSnippet(publicKey: string, widgetId: string): string {
  return `// npm install @feedbackhub/react

import { FeedbackHubProvider, useFeedback } from "@feedbackhub/react";

function App() {
  return (
    <FeedbackHubProvider projectKey="${publicKey}" sdkUrl="${API_URL}/sdk.js" apiBaseUrl="${API_URL}">
      <YourApp />
    </FeedbackHubProvider>
  );
}

function FeedbackButton() {
  const feedback = useFeedback();
  return <button onClick={() => feedback.open("${widgetId}")}>Give feedback</button>;
}`;
}

export function buildVueSnippet(publicKey: string, widgetId: string): string {
  return `// npm install @feedbackhub/vue

// main.ts
import { createApp } from "vue";
import { createFeedbackHub } from "@feedbackhub/vue";
import App from "./App.vue";

const app = createApp(App);
app.use(createFeedbackHub({ projectKey: "${publicKey}", sdkUrl: "${API_URL}/sdk.js" }));
app.mount("#app");

// any component
<script setup lang="ts">
import { useFeedback } from "@feedbackhub/vue";
const feedback = useFeedback();
</script>

<template>
  <button @click="feedback.open('${widgetId}')">Give feedback</button>
</template>`;
}

export function buildAngularSnippet(publicKey: string, widgetId: string): string {
  return `// npm install @feedbackhub/angular

import { FeedbackHubModule } from "@feedbackhub/angular";

@NgModule({
  imports: [
    FeedbackHubModule.forRoot({ projectKey: "${publicKey}", sdkUrl: "${API_URL}/sdk.js" }),
  ],
})
export class AppModule {}

// any component
import { FeedbackHubService } from "@feedbackhub/angular";

@Component({ /* ... */ })
export class FeedbackButtonComponent {
  constructor(private feedback: FeedbackHubService) {}
  openWidget() {
    this.feedback.open("${widgetId}");
  }
}`;
}
