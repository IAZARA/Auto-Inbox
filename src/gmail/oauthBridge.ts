import { GMAIL_SCOPES, type GmailDesktopBridge, type GmailOAuthSession } from "./types";
import type { GmailSyncSnapshot } from "./types";

declare global {
  interface Window {
    autoInboxGmail?: GmailDesktopBridge;
  }
}

const DEMO_ACCOUNT = "support@auto-inbox.local";
const DEMO_HISTORY_ID = "9876543210";
const tokenTtlMs = 55 * 60 * 1000;

export function hasDesktopGmailBridge() {
  return typeof window !== "undefined" && Boolean(window.autoInboxGmail);
}

export async function connectGmailOAuth(): Promise<GmailOAuthSession> {
  if (hasDesktopGmailBridge() && window.autoInboxGmail) {
    return window.autoInboxGmail.connect({ scopes: GMAIL_SCOPES });
  }

  await wait(650);

  return {
    accountEmail: DEMO_ACCOUNT,
    expiresAt: Date.now() + tokenTtlMs,
    grantedScopes: GMAIL_SCOPES,
    historyId: DEMO_HISTORY_ID,
    mode: "demo-bridge",
  };
}

export async function disconnectGmailOAuth() {
  if (hasDesktopGmailBridge() && window.autoInboxGmail) {
    await window.autoInboxGmail.disconnect();
    return;
  }

  await wait(220);
}

export async function getGmailAccessToken() {
  if (!hasDesktopGmailBridge() || !window.autoInboxGmail) {
    return null;
  }

  return window.autoInboxGmail.getAccessToken();
}

export async function getDesktopGmailStatus(): Promise<Partial<GmailSyncSnapshot> | null> {
  if (!hasDesktopGmailBridge() || !window.autoInboxGmail?.getStatus) {
    return null;
  }

  return window.autoInboxGmail.getStatus();
}

export async function simulateInboxSync(
  currentHistoryId: string,
  loadedMessages: number,
  seenMessageIds: readonly string[] = [],
) {
  await wait(520);

  const parsedHistoryId = Number.parseInt(currentHistoryId || DEMO_HISTORY_ID, 10);
  const nextHistoryId = Number.isNaN(parsedHistoryId)
    ? DEMO_HISTORY_ID
    : String(parsedHistoryId + 27);
  const baseNumber = Math.max(loadedMessages, seenMessageIds.length);
  const duplicateCandidate = seenMessageIds[0] ?? `demo-gmail-${Math.max(1, baseNumber)}`;
  const candidateIds = [`demo-gmail-${baseNumber + 1}`, duplicateCandidate];

  return {
    historyId: nextHistoryId,
    messageIds: candidateIds,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
