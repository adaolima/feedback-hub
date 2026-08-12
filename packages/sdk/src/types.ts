export interface FeedbackHubOptions {
  projectKey: string;
  apiBaseUrl?: string;
  debug?: boolean;
}

export interface Identity {
  userId?: string;
  email?: string;
  name?: string;
}

export interface WidgetOption {
  id: string;
  label: string;
  value: string;
}

export interface SurveyQuestion {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  position: number;
  config: Record<string, any>;
  conditional_logic?: Record<string, any>;
  options: WidgetOption[];
}

export interface Survey {
  id: string;
  name: string;
  questions: SurveyQuestion[];
}

export interface WidgetConfig {
  displayMode?: string;
  appearance?: Record<string, any>;
  targeting?: {
    urls?: string[];
    delaySeconds?: number;
    minPageViews?: number;
    events?: string[];
    exitIntent?: boolean;
    frequency?: string;
  };
  question?: Record<string, any>;
}

export interface Widget {
  id: string;
  name: string;
  type: string;
  config: WidgetConfig;
  survey?: Survey;
}

export interface RemoteConfig {
  projectId: string;
  widgets: Widget[];
}
