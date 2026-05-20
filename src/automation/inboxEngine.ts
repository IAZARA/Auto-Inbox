import type { GmailHistoryResponse } from "../gmail/gmailApi";
import type { GmailMessageSummary, GmailSyncSnapshot } from "../gmail/types";
import { applyGmailDeduplication } from "./dedupeStore";

export type SimulatedInboxSyncResult = {
  historyId: string;
  messageIds: string[];
};

export type GmailSyncDependencies = {
  getAccessToken: () => Promise<string | null>;
  listNewInboxHistory: (
    accessToken: string,
    startHistoryId: string,
  ) => Promise<GmailHistoryResponse>;
  listInboxMessages: (accessToken: string, maxResults?: number) => Promise<GmailMessageSummary[]>;
  simulateInboxSync: (
    currentHistoryId: string,
    loadedMessages: number,
    seenMessageIds: readonly string[],
  ) => Promise<SimulatedInboxSyncResult>;
};

export async function runGmailInboxSync(
  current: GmailSyncSnapshot,
  dependencies: GmailSyncDependencies,
): Promise<GmailSyncSnapshot> {
  const accessToken = await dependencies.getAccessToken();

  if (accessToken && current.historyId) {
    const history = await dependencies.listNewInboxHistory(accessToken, current.historyId);
    const messageIds =
      history.history?.flatMap((item) =>
        item.messagesAdded?.map((message) => message.message.id) ?? [],
      ) ?? [];
    const fallbackNewMessages =
      history.history?.reduce(
        (total, item) => total + (item.messagesAdded?.length ?? 0),
        0,
      ) ?? 0;

    return applyGmailDeduplication(current, {
      historyId: history.historyId ?? current.historyId,
      messageIds,
      fallbackNewMessages,
    });
  }

  if (accessToken) {
    const messages = await dependencies.listInboxMessages(accessToken, 10);

    return applyGmailDeduplication(current, {
      historyId: messages[0]?.historyId ?? current.historyId,
      messageIds: messages.map((message) => message.id),
    });
  }

  const snapshot = await dependencies.simulateInboxSync(
    current.historyId,
    current.loadedMessages,
    current.seenMessageIds,
  );

  return applyGmailDeduplication(current, {
    historyId: snapshot.historyId,
    messageIds: snapshot.messageIds,
  });
}

export function canRunGmailSync(snapshot: GmailSyncSnapshot) {
  return snapshot.status !== "disconnected" && snapshot.status !== "connecting";
}
