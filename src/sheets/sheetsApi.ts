import type {
  SheetActivityRow,
  SheetKnowledgeRow,
  SheetRuleRow,
  SheetsKnowledgeBase,
} from "./types";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type ValuesResponse = {
  range: string;
  values?: string[][];
};

type BatchValuesResponse = {
  valueRanges?: ValuesResponse[];
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

export async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
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

export async function readAutoInboxKnowledgeBase(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetsKnowledgeBase> {
  const params = new URLSearchParams();
  params.append("ranges", "FAQ!A2:G");
  params.append("ranges", "Rules!A2:F");

  const response = await sheetsFetch<BatchValuesResponse>(
    accessToken,
    `/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`,
  );

  const [faqValues, ruleValues] = response.valueRanges ?? [];

  return {
    faq: mapFaqRows(faqValues?.values ?? []),
    rules: mapRuleRows(ruleValues?.values ?? []),
  };
}

export async function appendActivityLog(
  accessToken: string,
  spreadsheetId: string,
  row: SheetActivityRow,
) {
  const params = new URLSearchParams({
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
  });

  return sheetsFetch<{ updates?: { updatedRange?: string; updatedRows?: number } }>(
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
}

export function extractSpreadsheetId(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return fromUrl?.[1] ?? trimmed;
}

function mapFaqRows(rows: string[][]): SheetKnowledgeRow[] {
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

function mapRuleRows(rows: string[][]): SheetRuleRow[] {
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

async function sheetsFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${SHEETS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets API ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

function normalizeBoolean(value?: string) {
  return ["1", "true", "yes", "y", "si", "s\u00ed", "enabled", "active"].includes(
    (value ?? "").trim().toLowerCase(),
  );
}
