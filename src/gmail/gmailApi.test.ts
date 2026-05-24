import { describe, expect, it } from "vitest";
import { buildRawEmail, normalizeMessage } from "./gmailApi";

describe("gmailApi", () => {
  it("normalizes a full Gmail message with a plain-text body", () => {
    const body = "Hello support,\n\nCan you help with my order?";
    const message = normalizeMessage({
      id: "abc123",
      threadId: "thread-1",
      historyId: "42",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "Can you help with my order?",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: "Jane Customer <jane@example.com>" },
          { name: "Subject", value: "Order question" },
          { name: "Date", value: "Tue, 21 May 2026 10:00:00 -0300" },
        ],
        parts: [
          {
            mimeType: "text/plain",
            body: {
              data: Buffer.from(body).toString("base64url"),
            },
            headers: [],
          },
        ],
      },
    });

    expect(message).toMatchObject({
      id: "abc123",
      threadId: "thread-1",
      from: "Jane Customer <jane@example.com>",
      fromEmail: "jane@example.com",
      subject: "Order question",
      bodyText: body,
      labelIds: ["INBOX", "UNREAD"],
    });
  });

  it("builds a Gmail-compatible raw draft payload", () => {
    const raw = buildRawEmail({
      to: "customer@example.com",
      subject: "Re: Order question",
      body: "Thanks for reaching out.",
    });

    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    expect(raw).not.toContain("=");
  });
});
