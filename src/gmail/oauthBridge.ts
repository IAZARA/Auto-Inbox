import { GMAIL_SCOPES, type GmailDesktopBridge, type GmailOAuthSession } from "./types";

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

export async function simulateInboxSync(currentHistoryId: string, loadedMessages: number) {
  await wait(520);

  const parsedHistoryId = Number.parseInt(currentHistoryId || DEMO_HISTORY_ID, 10);
  const nextHistoryId = Number.isNaN(parsedHistoryId)
    ? DEMO_HISTORY_ID
    : String(parsedHistoryId + 27);

  return {
    historyId: nextHistoryId,
    loadedMessages: Math.max(loadedMessages, 7),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
