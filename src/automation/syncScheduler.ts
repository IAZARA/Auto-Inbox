import type { GmailSyncSnapshot } from "../gmail/types";

export const heartbeatIntervals = [30, 60, 120, 300, 900] as const;
export const defaultHeartbeatIntervalSeconds = 120;

const gmailHeartbeatStorageKey = "auto-inbox:gmail-heartbeat";

export function getNextSyncAt(intervalSeconds: number) {
  return new Date(Date.now() + intervalSeconds * 1000).toISOString();
}

export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function loadPersistedGmailHeartbeat(): Partial<GmailSyncSnapshot> {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const rawValue = storage.getItem(gmailHeartbeatStorageKey);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue) as Partial<GmailSyncSnapshot>;
    const intervalSeconds = normalizeHeartbeatInterval(parsed.heartbeatIntervalSeconds);

    return {
      heartbeatEnabled: parsed.heartbeatEnabled ?? true,
      heartbeatIntervalSeconds: intervalSeconds,
      nextSyncInSeconds: intervalSeconds,
      seenMessageIds: Array.isArray(parsed.seenMessageIds) ? parsed.seenMessageIds : [],
      duplicateSkips: parsed.duplicateSkips ?? 0,
      newMessages: parsed.newMessages ?? 0,
    };
  } catch {
    return {};
  }
}

export function persistGmailHeartbeat(snapshot: GmailSyncSnapshot) {
  const storage = getLocalStorage();
  if (!storage) return;

  storage.setItem(
    gmailHeartbeatStorageKey,
    JSON.stringify({
      heartbeatEnabled: snapshot.heartbeatEnabled,
      heartbeatIntervalSeconds: snapshot.heartbeatIntervalSeconds,
      nextSyncAt: snapshot.nextSyncAt,
      seenMessageIds: snapshot.seenMessageIds,
      duplicateSkips: snapshot.duplicateSkips,
      newMessages: snapshot.newMessages,
    }),
  );
}

export function normalizeHeartbeatInterval(value?: number) {
  if (!value || !Number.isFinite(value)) return defaultHeartbeatIntervalSeconds;
  return heartbeatIntervals.includes(value as (typeof heartbeatIntervals)[number])
    ? value
    : defaultHeartbeatIntervalSeconds;
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
