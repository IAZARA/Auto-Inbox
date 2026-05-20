import type { GmailDraftRequest, GmailMessageSummary } from "./types";

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
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
  };
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
  const params = new URLSearchParams({ format: "metadata" });
  ["From", "Subject", "Date"].forEach((header) => params.append("metadataHeaders", header));

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
    body: JSON.stringify({ message: { raw } }),
  });
}

function normalizeMessage(message: GmailMessageMetadataResponse): GmailMessageSummary {
  const headers = new Map(
    (message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );

  return {
    id: message.id,
    threadId: message.threadId,
    historyId: message.historyId,
    from: headers.get("from") ?? "Unknown sender",
    subject: headers.get("subject") ?? "(no subject)",
    date: headers.get("date") ?? "",
    snippet: message.snippet ?? "",
  };
}

function buildRawEmail({ to, subject, body }: GmailDraftRequest) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return base64UrlEncode(message);
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
