"use client";

import { getGuestStatus } from "../services/guest-api";
import type { GuestUsage } from "../types";

import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  streamMessage,
} from "@/features/chat/services/conversations";
import {
  ensureGuestSession,
  transferGuestSession,
} from "@/features/chat/services/guest-session";
import { Conversation, Message } from "@/features/chat/types";
import { useKioTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { useBackendStatus } from "./use-backend-status";
import { useDictation } from "./use-dictation";

export function useChatController(mode: "account" | "guest") {
  const isGuest = mode === "guest";
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { theme, toggleTheme } = useKioTheme();
  const { notify, confirm: confirmToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingAnswer, setStreamingAnswer] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const reportError = useCallback(
    (message: string) => {
      if (message) notify({ title: message, tone: "error" });
    },
    [notify],
  );
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestUsage, setGuestUsage] = useState<GuestUsage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { backendStatus, checkBackend } = useBackendStatus();
  const {
    dictationSupported,
    isDictating,
    dictationTranscript,
    startDictation,
    acceptDictation,
    cancelDictation,
  } = useDictation(input, setInput, reportError);

  useEffect(() => {
    // Browser storage is unavailable during SSR; restore the saved preference once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(
      window.localStorage.getItem("kio-sidebar-collapsed") === "true",
    );
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("kio-sidebar-collapsed", String(next));
      return next;
    });
  }

  const token = useCallback(async () => {
    if (isGuest) {
      if (!guestToken) throw new Error("Guest session is still loading.");
      return guestToken;
    }
    const value = await getToken();
    if (!value)
      throw new Error("Your session has expired. Please sign in again.");
    return value;
  }, [getToken, guestToken, isGuest]);

  const refreshConversations = useCallback(async () => {
    const authToken = await token();
    if (!isGuest) {
      try {
        await transferGuestSession(authToken);
      } catch (requestError) {
        reportError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to transfer guest chats.",
        );
      }
    }
    const items = await listConversations(authToken, isGuest);
    setConversations(items);
  }, [token, isGuest, reportError]);

  useEffect(() => {
    if (!isGuest || backendStatus !== "online") return;
    ensureGuestSession()
      .then(({ token: issuedToken, usage }) => {
        setGuestToken(issuedToken);
        setGuestUsage(usage);
      })
      .catch((requestError) => {
        reportError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to start guest chat.",
        );
        setIsHistoryLoading(false);
        void checkBackend();
      });
  }, [isGuest, backendStatus, checkBackend, reportError]);

  useEffect(() => {
    if (!isGuest || !guestToken || !guestUsage) return;
    const delay =
      Math.max(0, Date.parse(guestUsage.resetAt) - Date.now()) + 1000;
    const timer = window.setTimeout(() => {
      getGuestStatus(guestToken)
        .then(setGuestUsage)
        .catch(() => {});
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isGuest, guestToken, guestUsage]);

  useEffect(() => {
    if (
      backendStatus !== "online" ||
      (isGuest ? !guestToken : !isLoaded || !isSignedIn)
    )
      return;
    // A newly available session or backend starts a fresh history request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHistoryLoading(true);
    refreshConversations()
      .catch((requestError) => {
        reportError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load conversations.",
        );
        void checkBackend();
      })
      .finally(() => setIsHistoryLoading(false));
  }, [
    isGuest,
    guestToken,
    isLoaded,
    isSignedIn,
    refreshConversations,
    backendStatus,
    checkBackend,
    reportError,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingAnswer?.content]);

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setStreamingAnswer(null);
    setInput("");
    setSidebarOpen(false);
  }

  async function selectConversation(id: string) {
    if (id === activeId || isLoading) return;
    setIsHistoryLoading(true);
    setMessages([]);
    setStreamingAnswer(null);
    setSidebarOpen(false);
    try {
      const conversation = await getConversation(await token(), id, isGuest);
      setActiveId(conversation.id);
      setMessages(conversation.messages);
    } catch (requestError) {
      reportError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the conversation.",
      );
      void checkBackend();
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function removeConversation(id: string) {
    if (isLoading || deletingId) return;
    const shouldDelete = await confirmToast({
      title: "Delete conversation?",
      description: "This conversation will be removed permanently.",
      confirmLabel: "Delete",
    });
    if (!shouldDelete) return;
    setDeletingId(id);
    try {
      await deleteConversation(await token(), id, isGuest);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (id === activeId) startNewChat();
      notify({ title: "Conversation deleted", tone: "success" });
    } catch (requestError) {
      reportError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete the conversation.",
      );
      void checkBackend();
    } finally {
      setDeletingId(null);
    }
  }

  async function submitMessage(text = input) {
    const question = text.trim();
    if (!question || isLoading) return;
    if (
      isGuest &&
      guestUsage &&
      guestUsage.remaining <= 0 &&
      Date.now() < Date.parse(guestUsage.resetAt)
    ) {
      reportError(
        "Guest questions are used up for today. Sign in to continue.",
      );
      return;
    }

    if (isDictating) cancelDictation();
    setInput("");
    setIsLoading(true);
    setStreamingAnswer(null);
    let conversationId = activeId;
    const optimisticId = crypto.randomUUID();
    let presentationTimer: number | null = null;
    let streamedContent = "";
    let displayedLength = 0;
    let streamFinished = false;
    let finishPresentation = () => {};
    const presentationDone = new Promise<void>((resolve) => {
      finishPresentation = resolve;
    });

    function presentNextChunk() {
      presentationTimer = null;
      const remaining = streamedContent.length - displayedLength;
      if (remaining > 0) {
        const revealCount = Math.min(
          remaining,
          Math.max(2, Math.min(24, Math.ceil(remaining / 8))),
        );
        displayedLength += revealCount;
        const visibleContent = streamedContent.slice(0, displayedLength);
        setStreamingAnswer((current) =>
          current ? { ...current, content: visibleContent } : current,
        );
      }
      if (streamFinished && displayedLength >= streamedContent.length) {
        finishPresentation();
        return;
      }
      presentationTimer = window.setTimeout(presentNextChunk, 32);
    }

    function schedulePresentation() {
      if (presentationTimer === null) {
        presentationTimer = window.setTimeout(presentNextChunk, 0);
      }
    }

    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "user",
        content: question,
        sequence: current.length + 1,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const authToken = await token();
      if (!conversationId) {
        const created = await createConversation(authToken, isGuest);
        conversationId = created.id;
        setActiveId(created.id);
        setConversations((current) => [created, ...current]);
      }
      const result = await streamMessage(
        authToken,
        conversationId,
        question,
        {
          onStart: (event) => {
            setMessages((current) => [
              ...current.filter(
                (message) =>
                  message.id !== optimisticId &&
                  message.id !== event.userMessage.id,
              ),
              event.userMessage,
            ]);
            setConversations((current) => [
              event.conversation,
              ...current.filter((item) => item.id !== event.conversation.id),
            ]);
            setStreamingAnswer({
              id: `stream-${event.userMessage.id}`,
              role: "assistant",
              content: "",
              sequence: event.userMessage.sequence + 1,
              metadata: {},
              createdAt: new Date().toISOString(),
            });
            schedulePresentation();
          },
          onDelta: (content) => {
            streamedContent += content;
            schedulePresentation();
          },
        },
        isGuest,
      );
      streamFinished = true;
      schedulePresentation();
      await presentationDone;
      setMessages((current) => [
        ...current.filter(
          (message) =>
            message.id !== optimisticId &&
            message.id !== result.userMessage.id &&
            message.id !== result.assistantMessage.id,
        ),
        result.userMessage,
        result.assistantMessage,
      ]);
      setStreamingAnswer(null);
      setConversations((current) => [
        result.conversation,
        ...current.filter((item) => item.id !== result.conversation.id),
      ]);
    } catch (requestError) {
      if (presentationTimer !== null) window.clearTimeout(presentationTimer);
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setStreamingAnswer(null);
      reportError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong.",
      );
      void checkBackend();
    } finally {
      if (isGuest && guestToken) {
        getGuestStatus(guestToken)
          .then(setGuestUsage)
          .catch(() => {});
      }
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  return {
    isGuest,
    user,
    theme,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    input,
    setInput,
    conversations,
    activeId,
    messages,
    streamingAnswer,
    isLoading,
    isHistoryLoading,
    deletingId,
    dictationSupported,
    isDictating,
    dictationTranscript,
    guestToken,
    guestUsage,
    backendStatus,
    bottomRef,
    toggleSidebarCollapsed,
    checkBackend,
    startNewChat,
    selectConversation,
    removeConversation,
    submitMessage,
    handleSubmit,
    startDictation,
    acceptDictation,
    cancelDictation,
  };
}

export type ChatController = ReturnType<typeof useChatController>;
