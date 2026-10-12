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

export const starterPrompts = [
  "What can cause a persistent headache?",
  "How can I improve my sleep routine?",
  "When should I seek care for a fever?",
  "How can I prepare for a medical appointment?",
];
