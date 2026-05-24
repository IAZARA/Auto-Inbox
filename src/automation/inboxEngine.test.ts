import { describe, expect, it, vi } from "vitest";
import { runGmailInboxSync, type GmailSyncDependencies } from "./inboxEngine";
import type { GmailSyncSnapshot } from "../gmail/types";

const baseSnapshot: GmailSyncSnapshot = {
  status: "connected",
  mode: "desktop-oauth",
  accountEmail: "support@example.com",
  lastSyncAt: "",
  nextSyncInSeconds: 120,
  nextSyncAt: "",
  heartbeatEnabled: true,
  heartbeatIntervalSeconds: 120,
  historyId: "100",
  loadedMessages: 0,
  newMessages: 0,
  duplicateSkips: 0,
  seenMessageIds: [],
};

const message = {
  id: "msg-1",
  threadId: "thread-1",
  historyId: "101",
  from: "Jane <jane@example.com>",
  fromEmail: "jane@example.com",
  subject: "Question",
  date: "",
  snippet: "Question",
  bodyText: "Question body",
  labelIds: ["INBOX"],
};

describe("runGmailInboxSync", () => {
  it("loads the first inbox page even when Gmail already returned a profile history ID", async () => {
    const dependencies = {
      getAccessToken: vi.fn(async () => "token"),
      listInboxMessages: vi.fn(async () => [message]),
      listNewInboxHistory: vi.fn(),
      getMessage: vi.fn(),
      simulateInboxSync: vi.fn(),
    } satisfies GmailSyncDependencies;

    const result = await runGmailInboxSync(baseSnapshot, dependencies);

    expect(dependencies.listInboxMessages).toHaveBeenCalledWith("token", 10);
    expect(dependencies.listNewInboxHistory).not.toHaveBeenCalled();
    expect(result.messages).toEqual([message]);
    expect(result.snapshot.loadedMessages).toBe(1);
    expect(result.snapshot.seenMessageIds).toEqual(["msg-1"]);
  });

  it("uses Gmail history after the first page has established seen IDs", async () => {
    const dependencies = {
      getAccessToken: vi.fn(async () => "token"),
      listInboxMessages: vi.fn(),
      listNewInboxHistory: vi.fn(async () => ({
        historyId: "120",
        history: [
          {
            id: "history-1",
            messagesAdded: [
              { message: { id: "msg-1", threadId: "thread-1", labelIds: ["INBOX"] } },
              { message: { id: "msg-2", threadId: "thread-2", labelIds: ["INBOX"] } },
            ],
          },
        ],
      })),
      getMessage: vi.fn(async (_token: string, id: string) => ({ ...message, id })),
      simulateInboxSync: vi.fn(),
    } satisfies GmailSyncDependencies;

    const result = await runGmailInboxSync(
      { ...baseSnapshot, loadedMessages: 1, seenMessageIds: ["msg-1"] },
      dependencies,
    );

    expect(dependencies.listNewInboxHistory).toHaveBeenCalledWith("token", "100");
    expect(dependencies.getMessage).toHaveBeenCalledWith("token", "msg-2");
    expect(result.messages.map((item) => item.id)).toEqual(["msg-2"]);
    expect(result.snapshot.newMessages).toBe(1);
    expect(result.snapshot.duplicateSkips).toBe(1);
  });
});
