import type { GmailDraftRequest, GmailHistoryResponse, GmailMessageSummary } from "./types";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessageMetadataResponse = {
  id: string;
  threadId: string;
  historyId?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    mimeType?: string;
    body?: {
      data?: string;
    };
    headers?: GmailHeader[];
    parts?: GmailMessageMetadataResponse["payload"][];
  };
};

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gmail API ${response.status}: ${details}`);
  }

  return response.json() as Promise<T>;
}

export async function listInboxMessageIds(
  accessToken: string,
  maxResults = 10,
  query = "newer_than:7d",
): Promise<GmailListResponse> {
  const params = new URLSearchParams({
    labelIds: "INBOX",
    maxResults: String(maxResults),
    q: query,
  });

  return gmailFetch<GmailListResponse>(accessToken, `/messages?${params.toString()}`);
}

export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageSummary> {
  const params = new URLSearchParams({ format: "full" });

  const message = await gmailFetch<GmailMessageMetadataResponse>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
  );

  return normalizeMessage(message);
}

export async function listInboxMessages(
  accessToken: string,
  maxResults = 10,
): Promise<GmailMessageSummary[]> {
  const response = await listInboxMessageIds(accessToken, maxResults);
  const ids = response.messages ?? [];

  return Promise.all(ids.map((message) => getMessageMetadata(accessToken, message.id)));
}

export async function listNewInboxHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<GmailHistoryResponse> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: "messageAdded",
    labelId: "INBOX",
  });

  return gmailFetch<GmailHistoryResponse>(accessToken, `/history?${params.toString()}`);
}

export async function createGmailDraft(
  accessToken: string,
  draft: GmailDraftRequest,
): Promise<{ id: string; message: { id: string; threadId: string } }> {
  const raw = buildRawEmail(draft);

  return gmailFetch(accessToken, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw,
        ...(draft.threadId ? { threadId: draft.threadId } : {}),
      },
    }),
  });
}

export function normalizeMessage(message: GmailMessageMetadataResponse): GmailMessageSummary {
  const headers = new Map(
    (message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );
  const from = headers.get("from") ?? "Unknown sender";

  return {
    id: message.id,
    threadId: message.threadId,
    historyId: message.historyId,
    from,
    fromEmail: extractEmailAddress(from),
    subject: headers.get("subject") ?? "(no subject)",
    date: headers.get("date") ?? "",
    snippet: message.snippet ?? "",
    bodyText: extractBodyText(message.payload) || message.snippet || "",
    labelIds: message.labelIds ?? [],
  };
}

export function buildRawEmail({ to, subject, body }: GmailDraftRequest) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return base64UrlEncode(message);
}

function extractBodyText(payload: GmailMessageMetadataResponse["payload"]): string {
  if (!payload) return "";

  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  collectBodyParts(payload, plainParts, htmlParts);

  if (plainParts.length > 0) {
    return normalizeWhitespace(plainParts.join("\n\n"));
  }

  return normalizeWhitespace(htmlParts.map(stripHtml).join("\n\n"));
}

function collectBodyParts(
  payload: GmailMessageMetadataResponse["payload"],
  plainParts: string[],
  htmlParts: string[],
) {
  if (!payload) return;

  const data = payload.body?.data;
  if (data && payload.mimeType === "text/plain") {
    plainParts.push(decodeBase64UrlText(data));
  } else if (data && payload.mimeType === "text/html") {
    htmlParts.push(decodeBase64UrlText(data));
  }

  payload.parts?.forEach((part) => collectBodyParts(part, plainParts, htmlParts));
}

function decodeBase64UrlText(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
