import type {
  AutoInboxAIBridge,
  AutoInboxAnalysisRequest,
  AutoInboxAnalysisResult,
  AutoInboxAIStatus,
} from "./types";

declare global {
  interface Window {
    autoInboxAI?: AutoInboxAIBridge;
  }
}

export function hasDesktopAIBridge() {
  return typeof window !== "undefined" && Boolean(window.autoInboxAI);
}

export async function getAutoInboxAIStatus(): Promise<AutoInboxAIStatus> {
  if (hasDesktopAIBridge() && window.autoInboxAI) {
    return window.autoInboxAI.getStatus();
  }

  return {
    status: "demo",
    mode: "demo-bridge",
    provider: "demo",
    providerLabel: "Demo rules",
    model: "demo-rules",
    apiKeyEnv: "",
  };
}

export async function analyzeEmail(
  request: AutoInboxAnalysisRequest,
): Promise<AutoInboxAnalysisResult> {
  if (hasDesktopAIBridge() && window.autoInboxAI) {
    try {
      return await window.autoInboxAI.analyzeEmail(request);
    } catch {
      return analyzeEmailWithDemoRules(request);
    }
  }

  await wait(480);
  return analyzeEmailWithDemoRules(request);
}

function analyzeEmailWithDemoRules({
  email,
  knowledgeBase,
}: AutoInboxAnalysisRequest): AutoInboxAnalysisResult {
  const haystack = `${email.subject}\n${email.bodyText}`.toLowerCase();
  const matchedRules = knowledgeBase.rules.filter((rule) =>
    haystack.includes(rule.matchText.toLowerCase()),
  );
  const firstRule = matchedRules[0];
  const fallbackIntent = haystack.includes("invoice")
    ? "billing"
    : haystack.includes("return") || haystack.includes("refund")
      ? "returns"
      : haystack.includes("price") || haystack.includes("plan")
        ? "pricing"
        : haystack.includes("ship") || haystack.includes("tracking") || haystack.includes("order")
          ? "shipping"
          : "general";
  const intent = firstRule?.intent || fallbackIntent;
  const matchedQuestions = knowledgeBase.faq
    .filter((row) => row.intent.toLowerCase() === intent.toLowerCase())
    .slice(0, 3)
    .map((row) => ({
      question: row.question,
      answer: row.answer,
      source: row.source,
    }));
  const answerHint = matchedQuestions[0]?.answer;

  return {
    intent,
    confidence: matchedQuestions.length > 0 || firstRule ? 82 : 64,
    summary: email.bodyText.slice(0, 180) || email.subject,
    requiresHumanReview: true,
    matchedQuestions,
    draft: [
      `Hi ${getFirstName(email.sender)},`,
      "",
      "Thanks for reaching out. I reviewed your message and can help with this.",
      answerHint ? `\n${answerHint}` : "",
      "\nPlease review the details above before sending this reply.",
      "",
      "Best regards,",
      "Support Team",
    ]
      .filter(Boolean)
      .join("\n"),
    activityItems: [
      `Email analyzed from ${email.sender}`,
      `Intent identified: ${intent}`,
      `FAQ matches found (${matchedQuestions.length})`,
      "Draft generated for human review",
    ],
  };
}

function getFirstName(sender: string) {
  return sender.split(/\s+/)[0]?.replace(/[<"].*$/, "") || "there";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
