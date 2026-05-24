import type { SheetKnowledgeRow, SheetRuleRow } from "../sheets/types";

export type AutoInboxAIProvider =
  | "openai"
  | "deepseek"
  | "anthropic"
  | "moonshot"
  | "custom-openai-compatible";

export type AutoInboxAIMode = "desktop-llm" | "demo-bridge";

export type AutoInboxAIStatus = {
  status: "configured" | "missing-key" | "demo" | "error";
  mode: AutoInboxAIMode;
  provider: AutoInboxAIProvider | "demo";
  providerLabel: string;
  model: string;
  apiKeyEnv: string;
  baseUrl?: string;
  error?: string;
};

export type AutoInboxAnalysisRequest = {
  email: {
    id: string;
    sender: string;
    senderEmail: string;
    subject: string;
    bodyText: string;
  };
  knowledgeBase: {
    faq: SheetKnowledgeRow[];
    rules: SheetRuleRow[];
  };
};

export type AutoInboxAnalysisResult = {
  intent: string;
  confidence: number;
  summary: string;
  requiresHumanReview: boolean;
  matchedQuestions: Array<{
    question: string;
    answer: string;
    source: string;
  }>;
  draft: string;
  activityItems: string[];
};

export type AutoInboxAIBridge = {
  getStatus: () => Promise<AutoInboxAIStatus>;
  analyzeEmail: (request: AutoInboxAnalysisRequest) => Promise<AutoInboxAnalysisResult>;
};
