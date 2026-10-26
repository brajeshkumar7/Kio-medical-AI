"use client";

import KioAgentLoader, {
  KioLoadingIndicator,
} from "@/components/brand/kio-agent-loader";

import type { ChatController } from "../hooks/use-chat-controller";
import MessageBubble from "./message-bubble";

type Props = Pick<
  ChatController,
  | "isHistoryLoading"
  | "messages"
  | "isLoading"
  | "streamingAnswer"
  | "bottomRef"
>;

export default function MessageList({
  isHistoryLoading,
  messages,
  isLoading,
  streamingAnswer,
  bottomRef,
}: Props) {
  return (
    <div className="message-list">
      {isHistoryLoading && (
        <div className="history-loading">
          <KioLoadingIndicator size="section" label="Loading conversation..." />
        </div>
      )}
      {messages.map((message) => (
        <MessageBubble message={message} key={message.id} />
      ))}
      {isLoading && (
        <div className="message-row message-row-assistant agent-loader-row">
          <KioAgentLoader />
        </div>
      )}
      {streamingAnswer?.content && <MessageBubble message={streamingAnswer} />}
      <div ref={bottomRef} />
    </div>
  );
}
