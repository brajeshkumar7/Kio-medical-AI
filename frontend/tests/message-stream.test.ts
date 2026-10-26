import { describe, expect, it, vi } from "vitest";
import { readMessageStream } from "@/features/chat/services/message-stream";

function responseFromChunks(chunks: Uint8Array[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  );
}

describe("message stream decoding", () => {
  it("handles fragmented JSON, split UTF-8, blank lines, and an unterminated final line", async () => {
    const start = {
      type: "start",
      userMessage: { id: "user-1" },
      conversation: { id: "chat-1" },
      sources: [],
    };
    const complete = {
      type: "complete",
      userMessage: { id: "user-1" },
      assistantMessage: { id: "answer-1" },
      conversation: { id: "chat-1" },
    };
    const bytes = new TextEncoder().encode(
      `${JSON.stringify(start)}\n\n${JSON.stringify({ type: "delta", content: "café 🩺" })}\n${JSON.stringify(complete)}`,
    );
    // One-byte chunks exercise every possible UTF-8 and event boundary.
    const callbacks = { onStart: vi.fn(), onDelta: vi.fn() };
    const result = await readMessageStream(
      responseFromChunks(Array.from(bytes, (byte) => Uint8Array.of(byte))),
      callbacks,
    );
    expect(callbacks.onStart).toHaveBeenCalledExactlyOnceWith(start);
    expect(callbacks.onDelta).toHaveBeenCalledExactlyOnceWith("café 🩺");
    expect(result).toEqual(complete);
  });

  it.each([
    ['{"type":"error","error":"Quota exhausted"}\n', "Quota exhausted"],
    [
      '{"type":"delta","content":"unfinished"}\n',
      "The response ended before the answer was saved.",
    ],
  ])("rejects failed or incomplete streams", async (body, message) => {
    await expect(
      readMessageStream(new Response(body), {
        onStart: vi.fn(),
        onDelta: vi.fn(),
      }),
    ).rejects.toThrow(message);
  });

  it("rejects malformed events and a missing response body", async () => {
    const callbacks = { onStart: vi.fn(), onDelta: vi.fn() };
    await expect(
      readMessageStream(new Response("not JSON\n"), callbacks),
    ).rejects.toThrow();
    await expect(
      readMessageStream(new Response(null), callbacks),
    ).rejects.toThrow("The response stream is unavailable.");
  });

  it("shows a safety retry error without delivering answer deltas", async () => {
    const callbacks = { onStart: vi.fn(), onDelta: vi.fn() };
    const message = "The safety check is temporarily unavailable. Please try again in a moment.";
    const body = JSON.stringify({ type: "start", sources: [] }) + "\n" +
      JSON.stringify({ type: "error", code: "SAFETY_CHECK_UNAVAILABLE", error: message }) + "\n";
    await expect(readMessageStream(new Response(body), callbacks)).rejects.toThrow(message);
    expect(callbacks.onStart).toHaveBeenCalledOnce();
    expect(callbacks.onDelta).not.toHaveBeenCalled();
  });
});
