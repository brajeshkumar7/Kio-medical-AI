export type SourceReference = {
  id: number;
  title: string;
  page: number | null;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
  metadata?: { sources?: SourceReference[] };
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
};

export type GuestUsage = { remaining: number; limit: number; resetAt: string };

export type ConversationDetail = Conversation & { messages: Message[] };

export type StreamStart = {
  type: "start";
  conversation: Conversation;
  userMessage: Message;
  sources: SourceReference[];
};

type StreamDelta = { type: "delta"; content: string };
export type StreamComplete = {
  type: "complete";
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
};
type StreamError = { type: "error"; error: string; code?: string };
export type StreamEvent =
  StreamStart | StreamDelta | StreamComplete | StreamError;
