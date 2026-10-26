"use client";

import { useChatController } from "../hooks/use-chat-controller";
import ChatComposer from "./chat-composer";
import GuestAllowance from "./guest-allowance";
import MessageList from "./message-list";
import ServiceStatus from "./service-status";
import Sidebar from "./sidebar";
import WelcomePanel from "./welcome-panel";
import WorkspaceHeader from "./workspace-header";

export default function ChatWorkspace({
  mode = "account",
}: {
  mode?: "account" | "guest";
}) {
  const controller = useChatController(mode);
  const {
    backendStatus,
    messages,
    isHistoryLoading,
    isGuest,
    guestUsage,
    sidebarOpen,
    conversations,
    activeId,
    setSidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    startNewChat,
    selectConversation,
    removeConversation,
    deletingId,
  } = controller;
  const hasConversation = messages.length > 0 || isHistoryLoading;
  // Quota eligibility uses the existing wall-clock deadline; usage refresh triggers rerenders.
  const guestBlocked =
    isGuest &&
    guestUsage !== null &&
    guestUsage.remaining <= 0 &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() < Date.parse(guestUsage.resetAt);
  if (backendStatus !== "online") return <ServiceStatus {...controller} />;
  return (
    <main className="app-shell">
      <Sidebar
        guest={isGuest}
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onNewChat={startNewChat}
        onSelect={(id) => void selectConversation(id)}
        onDelete={(id) => void removeConversation(id)}
        deletingId={deletingId}
      />
      <section className="workspace">
        <WorkspaceHeader {...controller} />

        {isGuest && <GuestAllowance {...controller} />}

        <div
          className={`conversation ${hasConversation ? "conversation-active" : ""}`}
        >
          {!hasConversation ? (
            <WelcomePanel {...controller} guestBlocked={guestBlocked} />
          ) : (
            <MessageList {...controller} />
          )}
        </div>

        <ChatComposer {...controller} guestBlocked={guestBlocked} />
      </section>
    </main>
  );
}
