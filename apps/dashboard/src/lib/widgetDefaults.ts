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
