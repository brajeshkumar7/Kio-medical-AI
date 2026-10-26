import { expect, it, vi } from "vitest";
import {
  deleteConversation,
  getConversation,
  listConversations,
  streamMessage,
} from "@/features/chat/services/conversations";
import { claimGuestSession } from "@/features/chat/services/guest-api";

it("preserves account and guest URLs, authorization, and encoded conversation IDs", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ conversations: [] }))
    .mockResolvedValueOnce(Response.json({ conversation: { id: "a/b" } }));
  vi.stubGlobal("fetch", request);
  await listConversations("account");
  await getConversation("guest", "a/b", true);
  expect(request).toHaveBeenNthCalledWith(
    1,
    "http://localhost:8080/api/conversations",
    expect.objectContaining({
      headers: {
        Authorization: "Bearer account",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }),
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    "http://localhost:8080/api/guest/conversations/a%2Fb",
    expect.objectContaining({
      headers: {
        Authorization: "Guest guest",
        "Content-Type": "application/json",
      },
    }),
  );
});

it("preserves streaming request payloads and completion responses", async () => {
  const complete = {
    type: "complete",
    conversation: { id: "a" },
    userMessage: { id: "u" },
    assistantMessage: { id: "m" },
  };
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(complete)));
  vi.stubGlobal("fetch", request);
  await expect(
    streamMessage(
      "guest",
      "a",
      "Question",
      { onStart: vi.fn(), onDelta: vi.fn() },
      true,
    ),
  ).resolves.toEqual(complete);
  expect(request).toHaveBeenCalledWith(
    "http://localhost:8080/api/guest/conversations/a/messages/stream",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ message: "Question" }),
      headers: {
        Authorization: "Guest guest",
        "Content-Type": "application/json",
      },
    }),
  );
});

it("preserves backend errors and account-to-guest claim headers", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: "Not found" }, { status: 404 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", request);
  await expect(deleteConversation("account", "missing")).rejects.toThrow(
    "Not found",
  );
  await claimGuestSession("account", "guest");
  expect(request).toHaveBeenLastCalledWith(
    "http://localhost:8080/api/guest/claim",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer account",
        "X-Kio-Guest-Token": "guest",
      },
    },
  );
});
