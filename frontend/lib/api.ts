import type { Conversation, Message, SourceReference } from "@/lib/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
const CONVERSATIONS_URL = `${API_URL}/api/conversations`;
const GUEST_URL = `${API_URL}/api/guest`;

export async function checkApiAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type GuestUsage = { remaining: number; limit: number; resetAt: string };

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

function authorizedHeaders(token: string, guest = false): HeadersInit {
  return { Authorization: `${guest ? "Guest" : "Bearer"} ${token}`, "Content-Type": "application/json" };
}

function conversationsUrl(guest: boolean): string {
  return guest ? `${GUEST_URL}/conversations` : CONVERSATIONS_URL;
}

async function responseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(payload?.error || `Request failed (${response.status})`);
}

async function requestJson<T>(url: string, token: string, init: RequestInit = {}, guest = false): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: authorizedHeaders(token, guest),
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function listConversations(token: string, guest = false): Promise<Conversation[]> {
  const result = await requestJson<{ conversations: Conversation[] }>(conversationsUrl(guest), token, {}, guest);
  return result.conversations;
}

export async function createConversation(token: string, guest = false): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(conversationsUrl(guest), token, {
    method: "POST",
  }, guest);
  return result.conversation;
}

export async function getConversation(token: string, id: string, guest = false): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(
    `${conversationsUrl(guest)}/${encodeURIComponent(id)}`,
    token,
    {},
    guest,
  );
  return result.conversation;
}

export async function deleteConversation(token: string, id: string, guest = false): Promise<void> {
  const response = await fetch(`${conversationsUrl(guest)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authorizedHeaders(token, guest),
  });
  if (!response.ok) throw await responseError(response);
}

export async function streamMessage(
  token: string,
  conversationId: string,
  message: string,
  callbacks: { onStart: (event: StreamStart) => void; onDelta: (content: string) => void },
  guest = false,
): Promise<StreamComplete> {
  const response = await fetch(
    `${conversationsUrl(guest)}/${encodeURIComponent(conversationId)}/messages/stream`,
    {
      method: "POST",
      headers: authorizedHeaders(token, guest),
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

export async function createGuestSession(): Promise<{ token: string } & GuestUsage> {
  const response = await fetch(`${GUEST_URL}/sessions`, { method: "POST", cache: "no-store" });
  if (!response.ok) throw await responseError(response);
  return response.json();
}

export async function getGuestStatus(token: string): Promise<GuestUsage> {
  return requestJson<GuestUsage>(`${GUEST_URL}/session`, token, {}, true);
}

export async function claimGuestSession(accountToken: string, guestToken: string): Promise<void> {
  const response = await fetch(`${GUEST_URL}/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accountToken}`, "X-Kio-Guest-Token": guestToken },
  });
  if (!response.ok) throw await responseError(response);
}
