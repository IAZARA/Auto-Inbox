import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import type { AddressInfo } from "node:net";

type OAuthConnectRequest = {
  scopes?: readonly string[];
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type GmailProfileResponse = {
  emailAddress: string;
  historyId?: string;
};

type SpreadsheetMetadataResponse = {
  spreadsheetId: string;
  properties?: {
    title?: string;
  };
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
};

type SheetActivityRow = {
  timestamp: string;
  emailId: string;
  sender: string;
  subject: string;
  intent: string;
  confidence: number;
  status: string;
  draftCreated: boolean;
};

type SheetsKnowledgeBase = {
  faq: Array<{
    enabled: boolean;
    intent: string;
    question: string;
    answer: string;
    tags: string[];
    source: string;
    updatedAt: string;
  }>;
  rules: Array<{
    enabled: boolean;
    priority: number;
    matchText: string;
    intent: string;
    action: string;
    notes: string;
  }>;
};

type AutoInboxAnalysisRequest = {
  email?: {
    id?: string;
    sender?: string;
    senderEmail?: string;
    subject?: string;
    bodyText?: string;
  };
  knowledgeBase?: SheetsKnowledgeBase;
};

type AutoInboxAnalysisResult = {
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

type AIProviderId =
  | "openai"
  | "deepseek"
  | "anthropic"
  | "moonshot"
  | "custom-openai-compatible";

type AIProviderProtocol = "openai-responses" | "openai-chat" | "anthropic-messages";

type AIProviderConfig = {
  id: AIProviderId;
  label: string;
  protocol: AIProviderProtocol;
  apiKey: string | null;
  apiKeyEnv: string;
  model: string;
  baseUrl: string;
  jsonMode: boolean;
};

type StoredSheetsConnection = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  tabs: string[];
  faqRows: number;
  ruleRows: number;
  activityRows: number;
  lastSyncAt: string;
};

type StoredGmailSession = {
  accountEmail: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  grantedScopes: string[];
  historyId?: string;
  sheets?: StoredSheetsConnection;
};

const defaultScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;
const sheetsScopes = ["https://www.googleapis.com/auth/spreadsheets"] as const;

const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const tokenRefreshBufferMs = 60_000;
const oauthTimeoutMs = 120_000;
const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "confidence",
    "summary",
    "requiresHumanReview",
    "matchedQuestions",
    "draft",
    "activityItems",
  ],
  properties: {
    intent: { type: "string" },
    confidence: { type: "number" },
    summary: { type: "string" },
    requiresHumanReview: { type: "boolean" },
    matchedQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "source"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          source: { type: "string" },
        },
      },
    },
    draft: { type: "string" },
    activityItems: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

let mainWindow: BrowserWindow | null = null;
let cachedSession: StoredGmailSession | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    title: "Auto-inbox",
    backgroundColor: "#f4f7f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    if (process.env.AUTO_INBOX_OPEN_DEVTOOLS === "true") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.iazara.autoinbox");
  await loadLocalEnv();
  registerGmailIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerGmailIpc() {
  ipcMain.handle("gmail:connect", async (_event, request?: OAuthConnectRequest) => {
    return connectGmail(request?.scopes?.length ? request.scopes : defaultScopes);
  });

  ipcMain.handle("gmail:disconnect", async () => {
    cachedSession = null;
    await deleteStoredSession();
  });

  ipcMain.handle("gmail:get-access-token", async () => getValidAccessToken());

  ipcMain.handle("gmail:get-status", async () => {
    const session = await loadStoredSession();
    if (!session) {
      return { status: "disconnected", mode: "desktop-oauth" };
    }

    return {
      status: "connected",
      mode: "desktop-oauth",
      accountEmail: session.accountEmail,
      historyId: session.historyId,
      loadedMessages: 0,
    };
  });

  ipcMain.handle(
    "sheets:connect",
    async (
      _event,
      request?: { spreadsheetId?: string; scopes?: readonly string[] },
    ) => connectSheets(request?.spreadsheetId ?? "", request?.scopes?.length ? request.scopes : sheetsScopes),
  );

  ipcMain.handle("sheets:disconnect", async () => {
    const session = await loadStoredSession();
    if (!session) return;
    const nextSession = { ...session };
    delete nextSession.sheets;
    await saveSession(nextSession);
  });

  ipcMain.handle("sheets:get-status", async () => {
    const session = await loadStoredSession();
    if (!session?.sheets) {
      return { status: "disconnected", mode: "desktop-oauth" };
    }

    return {
      status: "connected",
      mode: "desktop-oauth",
      ...session.sheets,
    };
  });

  ipcMain.handle(
    "sheets:read-knowledge-base",
    async (_event, request?: { spreadsheetId?: string }) => {
      const spreadsheetId = await getSpreadsheetIdFromRequest(request?.spreadsheetId);
      const accessToken = await requireValidAccessToken();
      return readSheetsKnowledgeBase(accessToken, spreadsheetId);
    },
  );

  ipcMain.handle(
    "sheets:append-activity-log",
    async (_event, request?: { spreadsheetId?: string; row?: SheetActivityRow }) => {
      const spreadsheetId = await getSpreadsheetIdFromRequest(request?.spreadsheetId);
      const accessToken = await requireValidAccessToken();
      return appendSheetsActivity(accessToken, spreadsheetId, request?.row);
    },
  );

  ipcMain.handle("ai:get-status", async () => getOpenAIStatus());

  ipcMain.handle("ai:analyze-email", async (_event, request?: AutoInboxAnalysisRequest) => {
    return analyzeEmailWithOpenAI(request);
  });
}

async function connectGmail(scopes: readonly string[]) {
  const storedSession = await loadStoredSession();
  if (storedSession && hasScopes(storedSession, scopes)) {
    const accessToken = await getValidAccessToken();
    if (accessToken) {
      const profile = await fetchGmailProfile(accessToken);
      const hydratedSession = {
        ...storedSession,
        accountEmail: profile.emailAddress,
        historyId: profile.historyId ?? storedSession.historyId,
      };
      await saveSession(hydratedSession);
      return toOAuthSession(hydratedSession);
    }
  }

  const token = await authorizeGoogle(scopes);
  const profile = await fetchGmailProfile(token.access_token);
  const session: StoredGmailSession = {
    ...storedSession,
    accountEmail: profile.emailAddress,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? storedSession?.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    grantedScopes: normalizeGrantedScopes(token.scope, scopes),
    historyId: profile.historyId,
  };

  await saveSession(session);
  return toOAuthSession(session);
}

async function authorizeGoogle(scopes: readonly string[]) {
  const clientId = getOAuthClientId();
  const clientSecret = getOAuthClientSecret();
  const { verifier, challenge } = createPkcePair();
  const state = base64Url(randomBytes(24));
  const callback = await createOAuthCallbackServer(state);

  const authUrl = new URL(googleAuthUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callback.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  await shell.openExternal(authUrl.toString());

  try {
    const code = await callback.waitForCode();
    return exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      codeVerifier: verifier,
      redirectUri: callback.redirectUri,
    });
  } finally {
    await callback.close();
  }
}

async function connectSheets(spreadsheetIdInput: string, scopes: readonly string[]) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) {
    throw new Error("Missing Google Sheets spreadsheet ID.");
  }

  const storedSession = await loadStoredSession();
  const requestedScopes = mergeScopes(storedSession?.grantedScopes ?? [], scopes);

  if (!storedSession || !hasScopes(storedSession, requestedScopes)) {
    const token = await authorizeGoogle(requestedScopes);
    const nextSession: StoredGmailSession = {
      ...storedSession,
      accountEmail: storedSession?.accountEmail ?? "",
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? storedSession?.refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
      grantedScopes: normalizeGrantedScopes(token.scope, requestedScopes),
    };

    await saveSession(nextSession);
  }

  const accessToken = await requireValidAccessToken();
  const metadata = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const knowledge = await readSheetsKnowledgeBase(accessToken, spreadsheetId).catch(() => ({
    faq: [],
    rules: [],
  }));
  const currentSession = await loadStoredSession();
  if (!currentSession) {
    throw new Error("Google OAuth session was not saved.");
  }

  const sheets: StoredSheetsConnection = {
    spreadsheetId: metadata.spreadsheetId,
    spreadsheetTitle: metadata.title,
    tabs: metadata.tabs,
    faqRows: knowledge.faq.length,
    ruleRows: knowledge.rules.length,
    activityRows: 0,
    lastSyncAt: new Date().toISOString(),
  };

  const nextSession = {
    ...currentSession,
    sheets,
  };

  await saveSession(nextSession);

  return {
    status: "connected",
    mode: "desktop-oauth",
    ...sheets,
  };
}

async function getValidAccessToken() {
  const session = await loadStoredSession();
  if (!session) return null;

  if (session.expiresAt - tokenRefreshBufferMs > Date.now()) {
    return session.accessToken;
  }

  if (!session.refreshToken) {
    cachedSession = null;
    await deleteStoredSession();
    return null;
  }

  const clientId = getOAuthClientId();
  const clientSecret = getOAuthClientSecret();
  const refreshed = await refreshAccessToken(clientId, clientSecret, session.refreshToken);
  const nextSession: StoredGmailSession = {
    ...session,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
    grantedScopes: normalizeGrantedScopes(refreshed.scope, session.grantedScopes),
  };

  await saveSession(nextSession);
  return nextSession.accessToken;
}

async function exchangeAuthorizationCode({
  clientId,
  clientSecret,
  code,
  codeVerifier,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string | null;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  return postGoogleToken(body);
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string | null,
  refreshToken: string,
) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  return postGoogleToken(body);
}

async function postGoogleToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed: ${await response.text()}`);
  }

  return response.json() as Promise<TokenResponse>;
}

async function fetchGmailProfile(accessToken: string): Promise<GmailProfileResponse> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail profile request failed: ${await response.text()}`);
  }

  return response.json() as Promise<GmailProfileResponse>;
}

async function requireValidAccessToken() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error("Google OAuth is not connected.");
  }

  return accessToken;
}

async function fetchSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const fields = "spreadsheetId,properties.title,sheets.properties.title";
  const metadata = await sheetsFetch<SpreadsheetMetadataResponse>(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
  );

  return {
    spreadsheetId: metadata.spreadsheetId,
    title: metadata.properties?.title ?? "Untitled spreadsheet",
    tabs:
      metadata.sheets
        ?.map((sheet) => sheet.properties?.title)
        .filter((title): title is string => Boolean(title)) ?? [],
  };
}

async function readSheetsKnowledgeBase(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetsKnowledgeBase> {
  const params = new URLSearchParams();
  params.append("ranges", "FAQ!A2:G");
  params.append("ranges", "Rules!A2:F");

  const response = await sheetsFetch<{ valueRanges?: Array<{ values?: string[][] }> }>(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`,
  );

  const [faqValues, ruleValues] = response.valueRanges ?? [];

  return {
    faq: mapFaqRows(faqValues?.values ?? []),
    rules: mapRuleRows(ruleValues?.values ?? []),
  };
}

async function appendSheetsActivity(
  accessToken: string,
  spreadsheetId: string,
  row?: SheetActivityRow,
) {
  if (!row) {
    throw new Error("Missing activity row.");
  }

  const params = new URLSearchParams({
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
  });

  const response = await sheetsFetch<{ updates?: { updatedRange?: string; updatedRows?: number } }>(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}/values/Activity!A:H:append?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({
        values: [
          [
            row.timestamp,
            row.emailId,
            row.sender,
            row.subject,
            row.intent,
            row.confidence,
            row.status,
            row.draftCreated ? "yes" : "no",
          ],
        ],
      }),
    },
  );

  const session = await loadStoredSession();
  if (session?.sheets?.spreadsheetId === spreadsheetId) {
    await saveSession({
      ...session,
      sheets: {
        ...session.sheets,
        activityRows: session.sheets.activityRows + (response.updates?.updatedRows ?? 1),
        lastSyncAt: new Date().toISOString(),
      },
    });
  }

  return response.updates ?? {};
}

function getOpenAIStatus() {
  const provider = getAIProviderConfig();
  return {
    status: provider.apiKey ? "configured" : "missing-key",
    mode: "desktop-llm",
    provider: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      apiKeyEnv: provider.apiKeyEnv,
      baseUrl: provider.baseUrl,
    };
}

async function analyzeEmailWithOpenAI(
  request?: AutoInboxAnalysisRequest,
): Promise<AutoInboxAnalysisResult> {
  const provider = getAIProviderConfig();
  if (!provider.apiKey) {
    throw new Error(`Missing ${provider.apiKeyEnv}. Add it to .env before generating AI replies.`);
  }

  const email = request?.email;
  if (!email?.subject || !email.bodyText) {
    throw new Error("Missing email subject or body for AI analysis.");
  }

  const knowledgeBase = request?.knowledgeBase ?? { faq: [], rules: [] };
  const promptPayload = buildAIPromptPayload(email, knowledgeBase);

  if (provider.protocol === "anthropic-messages") {
    return analyzeWithAnthropicMessages(provider, promptPayload);
  }

  if (provider.protocol === "openai-chat") {
    return analyzeWithOpenAICompatibleChat(provider, promptPayload);
  }

  return analyzeWithOpenAIResponses(provider, promptPayload);
}

async function analyzeWithOpenAIResponses(
  provider: AIProviderConfig,
  promptPayload: Record<string, unknown>,
) {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      instructions: getAIInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(promptPayload, null, 2),
            },
          ],
        },
      ],
      max_output_tokens: 900,
      temperature: 0.2,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "auto_inbox_analysis",
          strict: true,
          schema: analysisJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider.label} Responses API failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeOpenAIAnalysis(payload);
}

async function analyzeWithOpenAICompatibleChat(
  provider: AIProviderConfig,
  promptPayload: Record<string, unknown>,
) {
  const response = await fetch(getChatCompletionsUrl(provider.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: `${getAIInstructions()} Return only valid JSON.` },
        { role: "user", content: JSON.stringify(promptPayload, null, 2) },
      ],
      temperature: 0.2,
      max_tokens: 900,
      stream: false,
      ...(provider.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider.label} Chat Completions API failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeJSONAnalysis(extractChatCompletionText(payload));
}

async function analyzeWithAnthropicMessages(
  provider: AIProviderConfig,
  promptPayload: Record<string, unknown>,
) {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 900,
      temperature: 0.2,
      system: `${getAIInstructions()} Return only valid JSON.`,
      messages: [
        {
          role: "user",
          content: JSON.stringify(promptPayload, null, 2),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: analysisJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider.label} Messages API failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeJSONAnalysis(extractAnthropicMessageText(payload));
}

function normalizeOpenAIAnalysis(payload: unknown): AutoInboxAnalysisResult {
  const text = extractOpenAIOutputText(payload);
  return normalizeJSONAnalysis(text);
}

function normalizeJSONAnalysis(value: string): AutoInboxAnalysisResult {
  const parsed = JSON.parse(extractJSONText(value)) as Partial<AutoInboxAnalysisResult>;
  return {
    intent: String(parsed.intent ?? "general"),
    confidence: clampNumber(parsed.confidence, 0, 100),
    summary: String(parsed.summary ?? ""),
    requiresHumanReview: true,
    matchedQuestions: Array.isArray(parsed.matchedQuestions)
      ? parsed.matchedQuestions.map((match) => ({
          question: String(match.question ?? ""),
          answer: String(match.answer ?? ""),
          source: String(match.source ?? "Knowledge base"),
        }))
      : [],
    draft: String(parsed.draft ?? ""),
    activityItems: Array.isArray(parsed.activityItems)
      ? parsed.activityItems.map((item) => String(item))
      : [],
  };
}

function buildAIPromptPayload(
  email: NonNullable<AutoInboxAnalysisRequest["email"]>,
  knowledgeBase: SheetsKnowledgeBase,
) {
  return {
    email: {
      id: email.id ?? "",
      sender: email.sender ?? "Customer",
      senderEmail: email.senderEmail ?? "",
      subject: email.subject,
      bodyText: email.bodyText,
    },
    knowledgeBase: {
      faq: knowledgeBase.faq.slice(0, 20),
      rules: knowledgeBase.rules.slice(0, 20),
    },
    outputRequirements: {
      draftLanguage: "Use the same language as the customer when obvious; otherwise use English.",
      tone: "professional, direct, helpful",
      reviewMode: "create a draft for a human reviewer, never auto-send",
      jsonShape: {
        intent: "short label",
        confidence: "number from 0 to 100",
        summary: "one sentence",
        requiresHumanReview: true,
        matchedQuestions: [{ question: "string", answer: "string", source: "string" }],
        draft: "email draft body",
        activityItems: ["short audit log items"],
      },
    },
  };
}

function getAIInstructions() {
  return "You are Auto-inbox, a cautious human-in-the-loop support assistant. Classify the email, pick only relevant FAQ/rule context, and draft a concise reply. Do not claim that an order, invoice, refund, account, or shipment has been checked unless that fact appears in the provided context. If verification is needed, ask for the minimum missing detail. Always require human review.";
}

function extractOpenAIOutputText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not include output text.");
  }

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") return content.text;
      if (isRecord(content) && typeof content.output_text === "string") {
        return content.output_text;
      }
    }
  }

  throw new Error("OpenAI response did not include output text.");
}

function extractChatCompletionText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("Chat completion response did not include choices.");
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("Chat completion response did not include a message.");
  }

  const content = firstChoice.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .join("");
  }

  throw new Error("Chat completion response did not include text content.");
}

function extractAnthropicMessageText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new Error("Anthropic response did not include content.");
  }

  return payload.content
    .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
    .join("");
}

function extractJSONText(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  throw new Error("AI response did not include valid JSON.");
}

async function sheetsFetch<T>(
  accessToken: string,
  pathSuffix: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${pathSuffix}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets API request failed: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

function mapFaqRows(rows: string[][]): SheetsKnowledgeBase["faq"] {
  return rows
    .map(([enabled, intent, question, answer, tags, source, updatedAt]) => ({
      enabled: normalizeBoolean(enabled),
      intent: intent ?? "",
      question: question ?? "",
      answer: answer ?? "",
      tags: (tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      source: source ?? "Google Sheets",
      updatedAt: updatedAt ?? "",
    }))
    .filter((row) => row.enabled && row.question && row.answer);
}

function mapRuleRows(rows: string[][]): SheetsKnowledgeBase["rules"] {
  return rows
    .map(([enabled, priority, matchText, intent, action, notes]) => ({
      enabled: normalizeBoolean(enabled),
      priority: Number.parseInt(priority ?? "0", 10) || 0,
      matchText: matchText ?? "",
      intent: intent ?? "",
      action: action ?? "",
      notes: notes ?? "",
    }))
    .filter((row) => row.enabled && row.matchText);
}

async function getSpreadsheetIdFromRequest(spreadsheetId?: string) {
  const session = await loadStoredSession();
  const sessionSpreadsheetId = session?.sheets?.spreadsheetId;
  const resolved = extractSpreadsheetId(spreadsheetId ?? sessionSpreadsheetId ?? "");
  if (!resolved) {
    throw new Error("Missing Google Sheets spreadsheet ID.");
  }

  return resolved;
}

function extractSpreadsheetId(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return fromUrl?.[1] ?? trimmed;
}

function normalizeBoolean(value?: string) {
  return ["1", "true", "yes", "y", "si", "s\u00ed", "enabled", "active"].includes(
    (value ?? "").trim().toLowerCase(),
  );
}

async function createOAuthCallbackServer(expectedState: string) {
  let server: http.Server | null = null;
  let timeout: NodeJS.Timeout | null = null;

  const waitForCode = new Promise<string>((resolve, reject) => {
    server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "", `http://${request.headers.host}`);
      if (url.pathname !== "/oauth2callback") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(renderOAuthResultPage("Google authorization failed. You can close this tab."));
        reject(new Error(error));
        return;
      }

      if (!code || state !== expectedState) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(renderOAuthResultPage("Invalid OAuth response. You can close this tab."));
        reject(new Error("Invalid OAuth callback."));
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(renderOAuthResultPage("Auto-inbox is connected. You can close this tab."));
      resolve(code);
    });

    timeout = setTimeout(() => {
      reject(new Error("Google OAuth timed out."));
    }, oauthTimeoutMs);
  });

  const redirectUri = await new Promise<string>((resolve, reject) => {
    if (!server) {
      reject(new Error("OAuth callback server was not created."));
      return;
    }

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server?.address() as AddressInfo | null;
      if (!address) {
        reject(new Error("OAuth callback server did not provide an address."));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}/oauth2callback`);
    });
  });

  return {
    redirectUri,
    waitForCode: () => waitForCode,
    close: async () => {
      if (timeout) clearTimeout(timeout);
      if (!server?.listening) return;
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    },
  };
}

async function loadStoredSession(): Promise<StoredGmailSession | null> {
  if (cachedSession) return cachedSession;

  try {
    const encrypted = await fs.readFile(getSessionPath());
    const decrypted = safeStorage.decryptString(encrypted);
    cachedSession = JSON.parse(decrypted) as StoredGmailSession;
    return cachedSession;
  } catch {
    return null;
  }
}

async function saveSession(session: StoredGmailSession) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS encryption is not available for Gmail token storage.");
  }

  await fs.mkdir(path.dirname(getSessionPath()), { recursive: true });
  await fs.writeFile(getSessionPath(), safeStorage.encryptString(JSON.stringify(session)));
  cachedSession = session;
}

async function deleteStoredSession() {
  try {
    await fs.rm(getSessionPath(), { force: true });
  } catch {
    // The session file may not exist yet.
  }
}

function getSessionPath() {
  return path.join(app.getPath("userData"), "gmail-session.bin");
}

function getOAuthClientId() {
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID. Create a Google OAuth Desktop client and set it before connecting Gmail.",
    );
  }

  return clientId;
}

function getOAuthClientSecret() {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET ?? null;
}

function getAIProviderConfig(): AIProviderConfig {
  const provider = normalizeAIProvider(process.env.AI_PROVIDER);
  const sharedModel = process.env.AI_MODEL;
  const sharedBaseUrl = process.env.AI_BASE_URL;
  const sharedApiKey = process.env.AI_API_KEY;

  if (provider === "deepseek") {
    return {
      id: "deepseek",
      label: "DeepSeek",
      protocol: "openai-chat",
      apiKey: sharedApiKey ?? process.env.DEEPSEEK_API_KEY ?? null,
      apiKeyEnv: sharedApiKey ? "AI_API_KEY" : "DEEPSEEK_API_KEY",
      model: sharedModel ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      baseUrl: sharedBaseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      jsonMode: getBooleanEnv("AI_JSON_MODE", true),
    };
  }

  if (provider === "anthropic") {
    return {
      id: "anthropic",
      label: "Claude",
      protocol: "anthropic-messages",
      apiKey: sharedApiKey ?? process.env.ANTHROPIC_API_KEY ?? null,
      apiKeyEnv: sharedApiKey ? "AI_API_KEY" : "ANTHROPIC_API_KEY",
      model: sharedModel ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      baseUrl: sharedBaseUrl ?? process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
      jsonMode: false,
    };
  }

  if (provider === "moonshot") {
    return {
      id: "moonshot",
      label: "Kimi / Moonshot",
      protocol: "openai-chat",
      apiKey: sharedApiKey ?? process.env.MOONSHOT_API_KEY ?? null,
      apiKeyEnv: sharedApiKey ? "AI_API_KEY" : "MOONSHOT_API_KEY",
      model: sharedModel ?? process.env.MOONSHOT_MODEL ?? "kimi-k2.6",
      baseUrl: sharedBaseUrl ?? process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1",
      jsonMode: getBooleanEnv("AI_JSON_MODE", true),
    };
  }

  if (provider === "custom-openai-compatible") {
    return {
      id: "custom-openai-compatible",
      label: "Custom OpenAI-compatible",
      protocol: "openai-chat",
      apiKey: sharedApiKey ?? null,
      apiKeyEnv: "AI_API_KEY",
      model: sharedModel ?? "custom-model",
      baseUrl: sharedBaseUrl ?? "http://127.0.0.1:1234/v1",
      jsonMode: getBooleanEnv("AI_JSON_MODE", false),
    };
  }

  return {
    id: "openai",
    label: "OpenAI",
    protocol: "openai-responses",
    apiKey: sharedApiKey ?? process.env.OPENAI_API_KEY ?? null,
    apiKeyEnv: sharedApiKey ? "AI_API_KEY" : "OPENAI_API_KEY",
    model: sharedModel ?? process.env.OPENAI_MODEL ?? "gpt-5-mini",
    baseUrl: sharedBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    jsonMode: false,
  };
}

function normalizeAIProvider(value?: string): AIProviderId {
  const normalized = (value ?? "openai").trim().toLowerCase();
  if (normalized === "claude" || normalized === "anthropic") return "anthropic";
  if (normalized === "kimi" || normalized === "moonshot") return "moonshot";
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "custom" || normalized === "openai-compatible") {
    return "custom-openai-compatible";
  }
  return "openai";
}

function getChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function getBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y", "si", "s\u00ed", "on"].includes(
    value.trim().toLowerCase(),
  );
}

async function loadLocalEnv() {
  const envPaths = [path.join(process.cwd(), ".env"), path.join(app.getPath("userData"), ".env")];

  for (const envPath of envPaths) {
    try {
      const contents = await fs.readFile(envPath, "utf8");
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .forEach((line) => {
          const separatorIndex = line.indexOf("=");
          const key = line.slice(0, separatorIndex).trim();
          const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
          if (key && process.env[key] === undefined) {
            process.env[key] = value;
          }
        });
    } catch {
      // Local env files are optional.
    }
  }
}

function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());

  return { verifier, challenge };
}

function base64Url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function normalizeGrantedScopes(grantedScope: string | undefined, fallback: readonly string[]) {
  return grantedScope ? grantedScope.split(" ").filter(Boolean) : [...fallback];
}

function mergeScopes(...scopeGroups: Array<readonly string[]>) {
  return Array.from(new Set(scopeGroups.flat()));
}

function hasScopes(session: StoredGmailSession, scopes: readonly string[]) {
  return scopes.every((scope) => session.grantedScopes.includes(scope));
}

function toOAuthSession(session: StoredGmailSession) {
  return {
    accountEmail: session.accountEmail,
    expiresAt: session.expiresAt,
    grantedScopes: session.grantedScopes,
    historyId: session.historyId,
    mode: "desktop-oauth",
  };
}

function renderOAuthResultPage(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Auto-inbox Gmail</title>
    <style>
      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        place-items: center;
        background: #f4f7f8;
        color: #111827;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(520px, calc(100vw - 48px));
        padding: 28px;
        border: 1px solid #dfe7ec;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 22px 70px rgba(15, 23, 42, 0.14);
      }
      h1 { margin: 0 0 10px; font-size: 22px; }
      p { margin: 0; color: #52606c; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Auto-inbox</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clampNumber(value: unknown, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
