"use client";

import { KioLoadingIndicator } from "@/components/brand/kio-agent-loader";
import { RefreshCw } from "lucide-react";

import type { ChatController } from "../hooks/use-chat-controller";
import AssistantMark from "./assistant-mark";

type Props = Pick<ChatController, "backendStatus" | "checkBackend">;

export default function ServiceStatus({ backendStatus, checkBackend }: Props) {
  return (
    <main className="service-shell">
      <section className="service-status" role="status" aria-live="polite">
        <AssistantMark />
        <h1>
          {backendStatus === "checking"
            ? "Connecting to Kio"
            : "Chat is temporarily unavailable"}
        </h1>
        <p>
          {backendStatus === "checking"
            ? "Checking the chat service before opening your workspace."
            : "We cannot reach the chat service right now. Your sign-in is still active. Please try again in a moment."}
        </p>
        {backendStatus === "offline" && (
          <button
            className="service-retry"
            type="button"
            onClick={() => void checkBackend(true)}
          >
            <RefreshCw size={17} /> Try again
          </button>
        )}
        {backendStatus === "checking" && (
          <KioLoadingIndicator
            size="section"
            label="Connecting to chat service..."
          />
        )}
      </section>
    </main>
  );
}
