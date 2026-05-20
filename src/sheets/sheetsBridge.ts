import {
  AUTO_INBOX_SHEET_TABS,
  SHEETS_SCOPES,
  type SheetActivityRow,
  type SheetsBridge,
  type SheetsKnowledgeBase,
  type SheetsSyncSnapshot,
} from "./types";

declare global {
  interface Window {
    autoInboxSheets?: SheetsBridge;
  }
}

const demoSpreadsheetId = "demo-auto-inbox-sheet";

export function hasDesktopSheetsBridge() {
  return typeof window !== "undefined" && Boolean(window.autoInboxSheets);
}

export async function connectSheets(spreadsheetId: string): Promise<SheetsSyncSnapshot> {
  if (hasDesktopSheetsBridge() && window.autoInboxSheets) {
    return window.autoInboxSheets.connect({ spreadsheetId, scopes: SHEETS_SCOPES });
  }

  await wait(520);

  return {
    status: "connected",
    mode: "demo-bridge",
    spreadsheetId: spreadsheetId || demoSpreadsheetId,
    spreadsheetTitle: "AutoInbox Demo Sheet",
    lastSyncAt: new Date().toISOString(),
    faqRows: 3,
    ruleRows: 4,
    activityRows: 48,
    tabs: [...AUTO_INBOX_SHEET_TABS],
  };
}

export async function disconnectSheets() {
  if (hasDesktopSheetsBridge() && window.autoInboxSheets) {
    await window.autoInboxSheets.disconnect();
    return;
  }

  await wait(180);
}

export async function getDesktopSheetsStatus(): Promise<Partial<SheetsSyncSnapshot> | null> {
  if (!hasDesktopSheetsBridge() || !window.autoInboxSheets) {
    return null;
  }

  return window.autoInboxSheets.getStatus();
}

export async function readSheetsKnowledgeBase(spreadsheetId: string): Promise<SheetsKnowledgeBase> {
  if (hasDesktopSheetsBridge() && window.autoInboxSheets) {
    return window.autoInboxSheets.readKnowledgeBase({ spreadsheetId });
  }

  await wait(420);

  return {
    faq: [
      {
        enabled: true,
        intent: "shipping",
        question: "Where is my order?",
        answer: "Orders usually ship within 1-2 business days.",
        tags: ["shipping", "tracking"],
        source: "FAQ",
        updatedAt: "2026-05-20",
      },
      {
        enabled: true,
        intent: "returns",
        question: "Can I return an item?",
        answer: "Returns are available within 30 days when the product is unused.",
        tags: ["returns"],
        source: "FAQ",
        updatedAt: "2026-05-20",
      },
      {
        enabled: true,
        intent: "billing",
        question: "Can you resend an invoice?",
        answer: "Invoices can be resent after confirming the billing email.",
        tags: ["billing", "invoice"],
        source: "FAQ",
        updatedAt: "2026-05-20",
      },
    ],
    rules: [
      {
        enabled: true,
        priority: 1,
        matchText: "refund",
        intent: "returns",
        action: "draft",
        notes: "Ask for order number before suggesting next steps.",
      },
      {
        enabled: true,
        priority: 2,
        matchText: "invoice",
        intent: "billing",
        action: "draft",
        notes: "Verify billing identity before sending documents.",
      },
    ],
  };
}

export async function appendSheetActivityLog(spreadsheetId: string, row: SheetActivityRow) {
  if (hasDesktopSheetsBridge() && window.autoInboxSheets) {
    return window.autoInboxSheets.appendActivityLog({ spreadsheetId, row });
  }

  await wait(260);
  return { updatedRange: "Activity!A49:H49", updatedRows: 1 };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
