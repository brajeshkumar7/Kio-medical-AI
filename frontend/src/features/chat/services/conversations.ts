import {
  API_URL,
  authorizedHeaders,
  requestJson,
  responseError,
} from "@/lib/http/client";
import type {
  Conversation,
  ConversationDetail,
  StreamComplete,
} from "../types";
import { readMessageStream, type StreamCallbacks } from "./message-stream";

const CONVERSATIONS_URL = `${API_URL}/api/conversations`;
const GUEST_URL = `${API_URL}/api/guest`;

function conversationsUrl(guest: boolean): string {
  return guest ? `${GUEST_URL}/conversations` : CONVERSATIONS_URL;
}

export async function listConversations(
  token: string,
  guest = false,
): Promise<Conversation[]> {
  const result = await requestJson<{ conversations: Conversation[] }>(
    conversationsUrl(guest),
    token,
    {},
    guest,
  );
  return result.conversations;
}

export async function createConversation(
  token: string,
  guest = false,
): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(
    conversationsUrl(guest),
    token,
    {
      method: "POST",
    },
    guest,
  );
  return result.conversation;
}

export async function getConversation(
  token: string,
  id: string,
  guest = false,
): Promise<ConversationDetail> {
  const result = await requestJson<{ conversation: ConversationDetail }>(
    `${conversationsUrl(guest)}/${encodeURIComponent(id)}`,
    token,
    {},
    guest,
  );
  return result.conversation;
}

export async function deleteConversation(
  token: string,
  id: string,
  guest = false,
): Promise<void> {
  const response = await fetch(
    `${conversationsUrl(guest)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: authorizedHeaders(token, guest),
    },
  );
  if (!response.ok) throw await responseError(response);
}

export async function streamMessage(
  token: string,
  conversationId: string,
  message: string,
  callbacks: StreamCallbacks,
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
  return readMessageStream(response, callbacks);
}
