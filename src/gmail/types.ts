export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;

export type GmailScope = (typeof GMAIL_SCOPES)[number];

export type GmailConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

export type GmailBridgeMode = "desktop-oauth" | "demo-bridge";

export type GmailOAuthSession = {
  accountEmail: string;
  expiresAt: number;
  grantedScopes: readonly string[];
  historyId?: string;
  mode: GmailBridgeMode;
};

export type GmailSyncSnapshot = {
  status: GmailConnectionStatus;
  mode: GmailBridgeMode;
  accountEmail: string;
  lastSyncAt: string;
  nextSyncInSeconds: number;
  nextSyncAt: string;
  heartbeatEnabled: boolean;
  heartbeatIntervalSeconds: number;
  historyId: string;
  loadedMessages: number;
  newMessages: number;
  duplicateSkips: number;
  seenMessageIds: string[];
  error?: string;
};

export type GmailHistoryResponse = {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{
      message: {
        id: string;
        threadId: string;
        labelIds?: string[];
      };
    }>;
  }>;
  historyId?: string;
};

export type GmailDesktopBridge = {
  connect: (request: { scopes: readonly string[] }) => Promise<GmailOAuthSession>;
  disconnect: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getStatus?: () => Promise<Partial<GmailSyncSnapshot>>;
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  historyId?: string;
  from: string;
  fromEmail: string;
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
  labelIds: string[];
};

export type GmailDraftRequest = {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
};
