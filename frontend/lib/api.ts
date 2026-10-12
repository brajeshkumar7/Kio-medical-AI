import type { Conversation, Message, SourceReference } from "@/lib/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
const CONVERSATIONS_URL = `${API_URL}/api/conversations`;

type ConversationDetail = Conversation & { messages: Message[] };

type StreamStart = {
  type: "start";
  conversation: Conversation;
  userMessage: Message;
  sources: SourceReference[];
};

type StreamDelta = { type: "delta"; content: string };
type StreamComplete = {
  type: "complete";
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
};
type StreamError = { type: "error"; error: string };
type StreamEvent = StreamStart | StreamDelta | StreamComplete | StreamError;

function authorizedHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function responseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(payload?.error || `Request failed (${response.status})`);
}

async function requestJson<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: authorizedHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function listConversations(token: string): Promise<Conversation[]> {
  const result = await requestJson<{ conversations: Conversation[] }>(CONVERSATIONS_URL, token);
  return result.conversations;
}

export async function createConversation(token: string): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(CONVERSATIONS_URL, token, {
    method: "POST",
  });
  return result.conversation;
}

export async function getConversation(token: string, id: string): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(
    `${CONVERSATIONS_URL}/${encodeURIComponent(id)}`,
    token,
  );
  return result.conversation;
}

export async function deleteConversation(token: string, id: string): Promise<void> {
  const response = await fetch(`${CONVERSATIONS_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authorizedHeaders(token),
  });
  if (!response.ok) throw await responseError(response);
}

export async function streamMessage(
  token: string,
  conversationId: string,
  message: string,
  callbacks: { onStart: (event: StreamStart) => void; onDelta: (content: string) => void },
): Promise<StreamComplete> {
  const response = await fetch(
    `${CONVERSATIONS_URL}/${encodeURIComponent(conversationId)}/messages/stream`,
    {
      method: "POST",
      headers: authorizedHeaders(token),
      body: JSON.stringify({ message }),
    },
  );
  if (!response.ok) throw await responseError(response);
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
  if (!complete) throw new Error("The response ended before the answer was saved.");
  return complete;
}
