import type { StreamComplete, StreamEvent, StreamStart } from "../types";

export type StreamCallbacks = {
  onStart: (event: StreamStart) => void;
  onDelta: (content: string) => void;
};

export async function readMessageStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<StreamComplete> {
  if (!response.body) throw new Error("The response stream is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete: StreamComplete | null = null;

  function processLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    switch (event.type) {
      case "start":
        callbacks.onStart(event);
        break;
      case "delta":
        callbacks.onDelta(event.content);
        break;
      case "complete":
        complete = event;
        break;
      case "error":
        throw new Error(event.error);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      processLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  processLine(buffer);
  if (!complete)
    throw new Error("The response ended before the answer was saved.");
  return complete;
}
