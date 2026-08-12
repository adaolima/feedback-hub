export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  role?: string;
  created_at: string;
}

export interface Project {
  id: string;
  organisation_id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: string;
  project_id: string;
  survey_id: string | null;
  name: string;
  type: string;
  config: Record<string, any>;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  type: string;
  title: string;
  description: string | null;
  required: boolean;
  position: number;
  config: Record<string, any>;
  conditional_logic: Record<string, any>;
  options: Array<{ id: string; label: string; value: string; position: number }>;
}

export interface Survey {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  questions: SurveyQuestion[];
  created_at: string;
  updated_at: string;
}

export interface FeedbackResponse {
  id: string;
  project_id: string;
  widget_id: string;
  survey_id: string | null;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  rating: number | null;
  nps_score: number | null;
  feedback_text: string | null;
  metadata: Record<string, any>;
  created_at: string;
  answers?: Array<{ id: string; question_id: string | null; type: string; value: unknown }>;
}

export interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  type: "public" | "secret";
  key_value: string | null;
  last_four: string | null;
  revoked_at: string | null;
  created_at: string;
  secret?: string;
}

export interface Webhook {
  id: string;
  project_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  secret?: string;
}

export interface AnalyticsSummary {
  summary: {
    totalResponses: number;
    averageRating: number | null;
    positiveFeedback: number;
    negativeFeedback: number;
    responsesToday: number;
    responsesThisWeek: number;
    responsesThisMonth: number;
  };
  nps: {
    score: number;
    responses: number;
    promoters: number;
    passives: number;
    detractors: number;
    promoterPct: number;
    passivePct: number;
    detractorPct: number;
  };
  thumbs: { up: number; down: number };
  charts: {
    responsesOverTime: Array<{ day: string; count: string }>;
    ratingDistribution: Array<{ rating: number; count: string }>;
  };
}
