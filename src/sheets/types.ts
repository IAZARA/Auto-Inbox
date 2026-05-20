export const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"] as const;

export const AUTO_INBOX_SHEET_TABS = ["FAQ", "Rules", "Activity", "Settings"] as const;

export type SheetTabName = (typeof AUTO_INBOX_SHEET_TABS)[number];

export type SheetsConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

export type SheetsBridgeMode = "desktop-oauth" | "demo-bridge";

export type SheetsSyncSnapshot = {
  status: SheetsConnectionStatus;
  mode: SheetsBridgeMode;
  spreadsheetId: string;
  spreadsheetTitle: string;
  lastSyncAt: string;
  faqRows: number;
  ruleRows: number;
  activityRows: number;
  tabs: string[];
  error?: string;
};

export type SheetKnowledgeRow = {
  enabled: boolean;
  intent: string;
  question: string;
  answer: string;
  tags: string[];
  source: string;
  updatedAt: string;
};

export type SheetRuleRow = {
  enabled: boolean;
  priority: number;
  matchText: string;
  intent: string;
  action: string;
  notes: string;
};

export type SheetActivityRow = {
  timestamp: string;
  emailId: string;
  sender: string;
  subject: string;
  intent: string;
  confidence: number;
  status: string;
  draftCreated: boolean;
};

export type SheetsKnowledgeBase = {
  faq: SheetKnowledgeRow[];
  rules: SheetRuleRow[];
};

export type SheetsBridge = {
  connect: (request: {
    spreadsheetId: string;
    scopes: readonly string[];
  }) => Promise<SheetsSyncSnapshot>;
  disconnect: () => Promise<void>;
  getStatus: () => Promise<Partial<SheetsSyncSnapshot>>;
  readKnowledgeBase: (request: { spreadsheetId: string }) => Promise<SheetsKnowledgeBase>;
  appendActivityLog: (request: {
    spreadsheetId: string;
    row: SheetActivityRow;
  }) => Promise<{ updatedRange?: string; updatedRows?: number }>;
};
