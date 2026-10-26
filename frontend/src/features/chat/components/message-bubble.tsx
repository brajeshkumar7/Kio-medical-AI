"use client";

import MedicalAnswer from "@/features/chat/components/medical-answer";
import { Message } from "@/features/chat/types";

import AssistantMark from "./assistant-mark";

export default function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div
      className={`message-row ${isAssistant ? "message-row-assistant" : "message-row-user"}`}
    >
      {isAssistant && (
        <span className="assistant-signature">
          <AssistantMark small />
        </span>
      )}
      <div
        className={`message-bubble ${isAssistant ? "message-bubble-assistant" : "message-bubble-user"}`}
      >
        {isAssistant ? (
          <MedicalAnswer
            content={message.content}
            sources={message.metadata?.sources}
          />
        ) : (
          <p>{message.content}</p>
        )}
        <span className="message-time">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
