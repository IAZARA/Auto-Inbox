import type { GmailSyncSnapshot } from "../gmail/types";
import { getNextSyncAt } from "./syncScheduler";

export const maxSeenMessageIds = 500;

export function applyGmailDeduplication(
  current: GmailSyncSnapshot,
  result: { historyId: string; messageIds: string[]; fallbackNewMessages?: number },
): GmailSyncSnapshot {
  const uniqueIncoming = Array.from(new Set(result.messageIds.filter(Boolean)));
  const seen = new Set(current.seenMessageIds);
  const newIds = uniqueIncoming.filter((id) => !seen.has(id));
  const duplicateCount = Math.max(0, uniqueIncoming.length - newIds.length);
  const fallbackNewMessages =
    uniqueIncoming.length === 0 ? Math.max(0, result.fallbackNewMessages ?? 0) : 0;
  const countedNewMessages = newIds.length + fallbackNewMessages;
  const nextSeenMessageIds = [...newIds, ...current.seenMessageIds].slice(0, maxSeenMessageIds);

  return {
    ...current,
    status: "connected",
    lastSyncAt: new Date().toISOString(),
    nextSyncInSeconds: current.heartbeatIntervalSeconds,
    nextSyncAt: current.heartbeatEnabled ? getNextSyncAt(current.heartbeatIntervalSeconds) : "",
    historyId: result.historyId,
    loadedMessages: current.loadedMessages + countedNewMessages,
    newMessages: current.newMessages + countedNewMessages,
    duplicateSkips: current.duplicateSkips + duplicateCount,
    seenMessageIds: nextSeenMessageIds,
  };
}
