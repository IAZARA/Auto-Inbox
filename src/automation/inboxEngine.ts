import type { GmailHistoryResponse, GmailMessageSummary, GmailSyncSnapshot } from "../gmail/types";
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
  getMessage: (accessToken: string, messageId: string) => Promise<GmailMessageSummary>;
  simulateInboxSync: (
    currentHistoryId: string,
    loadedMessages: number,
    seenMessageIds: readonly string[],
  ) => Promise<SimulatedInboxSyncResult>;
};

export type GmailInboxSyncResult = {
  snapshot: GmailSyncSnapshot;
  messages: GmailMessageSummary[];
};

export async function runGmailInboxSync(
  current: GmailSyncSnapshot,
  dependencies: GmailSyncDependencies,
): Promise<GmailInboxSyncResult> {
  const accessToken = await dependencies.getAccessToken();

  if (accessToken && current.historyId && current.seenMessageIds.length > 0) {
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

    const newMessageIds = messageIds.filter((id) => !current.seenMessageIds.includes(id));
    const messages = await Promise.all(
      Array.from(new Set(newMessageIds)).map((messageId) =>
        dependencies.getMessage(accessToken, messageId),
      ),
    );

    return {
      snapshot: applyGmailDeduplication(current, {
        historyId: history.historyId ?? current.historyId,
        messageIds,
        fallbackNewMessages,
      }),
      messages,
    };
  }

  if (accessToken) {
    const messages = await dependencies.listInboxMessages(accessToken, 10);

    return {
      snapshot: applyGmailDeduplication(current, {
        historyId: messages[0]?.historyId ?? current.historyId,
        messageIds: messages.map((message) => message.id),
      }),
      messages,
    };
  }

  const snapshot = await dependencies.simulateInboxSync(
    current.historyId,
    current.loadedMessages,
    current.seenMessageIds,
  );

  return {
    snapshot: applyGmailDeduplication(current, {
      historyId: snapshot.historyId,
      messageIds: snapshot.messageIds,
    }),
    messages: [],
  };
}

export function canRunGmailSync(snapshot: GmailSyncSnapshot) {
  return snapshot.status !== "disconnected" && snapshot.status !== "connecting";
}
