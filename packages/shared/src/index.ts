/**
 * Shared types used by the API, dashboard, SDK and framework wrappers.
 * Keep this package framework-independent and dependency-free.
 */

/** Extensible question type union. Add new types here (e.g. "ranking", "matrix", "file_upload"). */
export type QuestionType =
  | "rating"
  | "nps"
  | "thumbs"
  | "emoji"
  | "text"
  | "choice"
  | "multiple_choice";

/** A widget can render a single question type directly, or a full multi-question survey. */
export type WidgetType = QuestionType | "survey";

export type WidgetStatus = "draft" | "published" | "archived";

export type DisplayMode = "inline" | "floating" | "bottom_bar" | "modal" | "triggered";

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/** Role -> allowed actions. Used by both API middleware and dashboard UI gating. */
export const ROLE_PERMISSIONS: Record<OrgRole, string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "org:manage",
    "project:manage",
    "widget:manage",
    "survey:manage",
    "response:read",
    "analytics:read",
    "user:manage",
    "apikey:manage",
    "webhook:manage",
  ],
  MEMBER: [
    "project:manage",
    "widget:manage",
    "survey:manage",
    "response:read",
    "analytics:read",
  ],
  VIEWER: ["response:read", "analytics:read"],
};

export function roleHasPermission(role: OrgRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export interface RatingConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  followUpQuestion?: string;
}

export interface NpsConfig {
  followUpQuestion?: string;
}

export interface EmojiConfig {
  emojis: string[]; // e.g. ["😡","😞","😐","🙂","😍"]
  question: string;
  followUpQuestion?: string;
}

export interface ThumbsConfig {
  question: string;
  followUpQuestion?: string;
}

export interface TextConfig {
  long: boolean;
  maxLength?: number;
  question: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

export interface ChoiceConfig {
  question: string;
  multiple: boolean;
  options: ChoiceOption[];
  allowOther: boolean;
}

export type QuestionConfig =
  | ({ type: "rating" } & RatingConfig)
  | ({ type: "nps" } & NpsConfig)
  | ({ type: "emoji" } & EmojiConfig)
  | ({ type: "thumbs" } & ThumbsConfig)
  | ({ type: "text" } & TextConfig)
  | ({ type: "choice" } & ChoiceConfig)
  | ({ type: "multiple_choice" } & ChoiceConfig);

export type ConditionOperator = "lte" | "gte" | "eq" | "neq" | "lt" | "gt";

export interface ConditionalRule {
  questionId: string;
  operator: ConditionOperator;
  value: number | string;
}

/** Simple AND-only conditional logic. Designed to extend to OR/nested groups later. */
export interface ConditionalLogic {
  all: ConditionalRule[];
  action: "show" | "skip_to" | "hide";
  targetQuestionId?: string;
}

export type WidgetPreset = "minimal" | "modern" | "rounded" | "corporate" | "dark" | "glass";

export interface WidgetAppearance {
  preset?: WidgetPreset;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  font?: string;
  fontSize?: number;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  buttonStyle?: "solid" | "outline" | "ghost";
  iconStyle?: "emoji" | "line" | "filled";
  colorMode?: "light" | "dark" | "auto";
  customCss?: Record<string, string>;
}

export type FrequencyRule =
  | "always"
  | "once"
  | "once_per_session"
  | "every_7_days"
  | "every_30_days";

export interface TargetingRules {
  urls?: string[]; // substrings or glob-like patterns
  delaySeconds?: number;
  minPageViews?: number;
  events?: string[]; // fires when any of these tracked events occur
  exitIntent?: boolean;
  returningUsersOnly?: boolean;
  identifiedOnly?: boolean;
  frequency?: FrequencyRule;
}

export interface WidgetConfig {
  displayMode: DisplayMode;
  appearance: WidgetAppearance;
  targeting: TargetingRules;
  question?: QuestionConfig;
}

export const NPS_CATEGORY = {
  classify(score: number): "detractor" | "passive" | "promoter" {
    if (score <= 6) return "detractor";
    if (score <= 8) return "passive";
    return "promoter";
  },
  calculate(scores: number[]): number {
    if (scores.length === 0) return 0;
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    return Math.round(((promoters - detractors) / scores.length) * 100);
  },
};

export interface DeviceContext {
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  userAgent?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  browser?: string;
  os?: string;
  language?: string;
  country?: string;
}

export const WEBHOOK_EVENTS = [
  "response.created",
  "response.updated",
  "survey.completed",
  "widget.published",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
