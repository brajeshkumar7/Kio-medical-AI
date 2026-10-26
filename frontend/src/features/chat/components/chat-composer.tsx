"use client";

import { Check, Mic, Paperclip, Send, X } from "lucide-react";
import Link from "next/link";

import type { ChatController } from "../hooks/use-chat-controller";

type Props = Pick<
  ChatController,
  | "guestUsage"
  | "handleSubmit"
  | "isDictating"
  | "dictationTranscript"
  | "cancelDictation"
  | "acceptDictation"
  | "input"
  | "isGuest"
  | "guestToken"
  | "setInput"
  | "submitMessage"
  | "startDictation"
  | "dictationSupported"
  | "isLoading"
> & { guestBlocked: boolean };

export default function ChatComposer({
  guestUsage,
  handleSubmit,
  isDictating,
  dictationTranscript,
  cancelDictation,
  acceptDictation,
  input,
  isGuest,
  guestToken,
  setInput,
  submitMessage,
  startDictation,
  dictationSupported,
  isLoading,
  guestBlocked,
}: Props) {
  return (
    <div className="composer-wrap">
      {guestBlocked && guestUsage && (
        <div className="guest-limit-message" role="alert">
          <strong>Guest questions are unavailable for today.</strong>
          <span>
            Your allowance resets at{" "}
            {new Date(guestUsage.resetAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </span>
          <Link href="/">Sign in to continue</Link>
        </div>
      )}
      <form className="composer" onSubmit={handleSubmit}>
        <button
          type="button"
          className="composer-tool"
          disabled
          aria-label="Attachments are coming soon"
          title="Attachments are coming soon"
        >
          <Paperclip size={19} />
        </button>
        {isDictating ? (
          <div className="dictation-session" role="status" aria-live="polite">
            <div className="dictation-waveform" aria-hidden="true">
              {Array.from({ length: 48 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    height: `${18 + ((index * 17) % 64)}%`,
                    animationDelay: `${-index * 34}ms`,
                  }}
                />
              ))}
            </div>
            <span className="sr-only">
              {dictationTranscript || "Listening"}
            </span>
            <button
              className="dictation-cancel"
              type="button"
              onClick={cancelDictation}
              aria-label="Cancel dictation"
              title="Cancel dictation"
            >
              <X size={20} />
            </button>
            <button
              className="dictation-accept"
              type="button"
              onClick={acceptDictation}
              aria-label="Use transcription"
              title="Use transcription"
            >
              <Check size={21} />
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={input}
              maxLength={8000}
              disabled={guestBlocked || (isGuest && !guestToken)}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder={
                guestBlocked
                  ? "Sign in to ask another question"
                  : "Ask anything about your health..."
              }
              rows={1}
            />
            <button
              type="button"
              className="dictate-button"
              onClick={startDictation}
              disabled={!dictationSupported || isLoading}
              aria-label="Dictate message"
              title={
                dictationSupported
                  ? "Dictate message"
                  : "Dictation is not supported by this browser"
              }
            >
              <Mic size={19} />
            </button>
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || guestBlocked || (isGuest && !guestToken)}
              aria-label={isLoading ? "Sending message" : "Send message"}
            >
              <Send size={18} />
            </button>
          </>
        )}
      </form>
      <p className="composer-note">
        Kio can make mistakes. This is not a substitute for professional medical
        advice.
      </p>
    </div>
  );
}
