"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  HeartPulse,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  SquarePen,
  Sun,
  Thermometer,
  Trash2,
  X,
} from "lucide-react";
import KioAgentLoader, { KioAnimatedMark, KioLoadingIndicator } from "@/components/kio-agent-loader";
import KioBrandMark from "@/components/kio-brand";
import MedicalAnswer from "@/components/medical-answer";
import { useKioTheme } from "@/components/theme-provider";
import { useToast } from "@/components/toast-provider";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  streamMessage,
} from "@/lib/api";
import { Conversation, Message, starterPrompts } from "@/lib/types";

type RecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;


function AssistantMark({ small = false }: { small?: boolean }) {
  return <KioBrandMark size={small ? 27 : 34} />;
}


function Sidebar({
  open,
  conversations,
  activeId,
  onClose,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onSelect,
  onDelete,
  deletingId,
}: {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, toggleTheme } = useKioTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const recentsRef = useRef<HTMLDivElement>(null);
  const visibleConversations = conversations.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const displayName = user?.fullName || user?.firstName || "Kio user";
  const email = user?.primaryEmailAddress?.emailAddress || "Signed in";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    function closeAccountMenu(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
      if (!recentsRef.current?.contains(event.target as Node)) setRecentsOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setRecentsOpen(false);
        setSearchOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("pointerdown", closeAccountMenu);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", closeAccountMenu);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const compact = collapsed && !open;

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: "/" });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      {open && <button className="sidebar-scrim" onClick={onClose} aria-label="Close menu" />}
      {searchOpen && (
        <div className="search-modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
          <section className="search-modal" role="dialog" aria-modal="true" aria-label="Search conversations" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-modal-input">
              <Search size={20} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
              <button className="icon-button" type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={19} /></button>
            </div>
            <div className="search-modal-results">
              <div className="search-modal-label">{searchQuery.trim() ? "Search results" : "Recent chats"}</div>
              {visibleConversations.map((conversation) => (
                <button
                  className={`search-result ${activeId === conversation.id ? "search-result-active" : ""}`}
                  type="button"
                  key={conversation.id}
                  onClick={() => {
                    onSelect(conversation.id);
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <MessageCircle size={19} />
                  <span>{conversation.title}</span>
                </button>
              ))}
              {visibleConversations.length === 0 && (
                <div className="search-empty"><Search size={20} /><span>No matching conversations</span></div>
              )}
            </div>
          </section>
        </div>
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""} ${compact ? "sidebar-collapsed" : ""}`}>
        {compact ? (
          <>
            <button className="rail-logo-button" type="button" onClick={onToggleCollapsed} aria-label="Show sidebar" title="Show sidebar">
              <span className="rail-logo-mark"><AssistantMark /></span>
              <span className="rail-logo-open"><PanelLeftOpen size={20} /></span>
            </button>
            <div className="rail-actions">
              <button className="icon-button rail-action" type="button" onClick={onNewChat} aria-label="New chat" title="New chat"><SquarePen size={20} /></button>
              <button className="icon-button rail-action" type="button" onClick={() => setSearchOpen(true)} aria-label="Search conversations" title="Search conversations"><Search size={20} /></button>
              <div className="rail-recents-control" ref={recentsRef}>
                <button className={`icon-button rail-action ${recentsOpen ? "rail-action-active" : ""}`} type="button" onClick={() => { setRecentsOpen((current) => !current); setAccountMenuOpen(false); }} aria-label="Recent conversations" title="Recent conversations"><MessageCircle size={20} /></button>
                {recentsOpen && (
                  <div className="rail-recents-popover">
                    <strong>Recents</strong>
                    <div>
                      {conversations.map((conversation) => (
                        <div className="rail-recent-row" key={conversation.id}>
                          <button
                            type="button"
                            className={activeId === conversation.id ? "rail-recent-item rail-recent-item-active" : "rail-recent-item"}
                            title={conversation.title}
                            onClick={() => {
                              onSelect(conversation.id);
                              setRecentsOpen(false);
                            }}
                          >
                            {conversation.title}
                          </button>
                          <button className={`rail-recent-delete ${deletingId === conversation.id ? "delete-pending" : ""}`} type="button" disabled={deletingId === conversation.id} onClick={() => onDelete(conversation.id)} aria-label={`Delete ${conversation.title}`} title="Delete conversation">
                            {deletingId === conversation.id ? <KioAnimatedMark size={30} label="" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      ))}
                      {conversations.length === 0 && <span className="rail-recents-empty">No conversations yet</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="brand-row">
              <div className="brand-lockup"><AssistantMark /></div>
              <div className="sidebar-header-actions">
                <button className="icon-button" type="button" onClick={() => setSearchOpen(true)} aria-label="Search conversations" title="Search conversations"><Search size={19} /></button>
                <button className="icon-button sidebar-collapse" type="button" onClick={onToggleCollapsed} aria-label="Hide sidebar" title="Hide sidebar"><PanelLeftClose size={18} /></button>
                <button className="icon-button sidebar-close" type="button" onClick={onClose} aria-label="Close sidebar"><PanelLeftClose size={18} /></button>
              </div>
            </div>

            <button className={`new-chat-button ${activeId === null ? "new-chat-button-active" : ""}`} onClick={onNewChat}>
              <SquarePen size={19} />
              <span>New chat</span>
            </button>

            <div className="sidebar-history">
              <div className="sidebar-section-label history-label">Recents</div>
              <div className="session-list">
                {conversations.map((conversation) => (
                  <div className="session-row" key={conversation.id}>
                    <button
                      className={`session-item ${activeId === conversation.id ? "session-item-active" : ""}`}
                      title={conversation.title}
                      onClick={() => onSelect(conversation.id)}
                    >
                      <span>{conversation.title}</span>
                    </button>
                    <button className={`session-delete ${deletingId === conversation.id ? "delete-pending" : ""}`} type="button" disabled={deletingId === conversation.id} onClick={() => onDelete(conversation.id)} aria-label={`Delete ${conversation.title}`} title="Delete conversation">
                      {deletingId === conversation.id ? <KioAnimatedMark size={30} label="" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="empty-history"><Clock3 size={15} /><span>No conversations yet</span></div>
                )}
              </div>
            </div>
          </>
        )}

        <div className={`account-control ${compact ? "account-control-collapsed" : ""}`} ref={accountMenuRef}>
          {accountMenuOpen && (
            <div className="account-menu" role="dialog" aria-label="Account settings">
              <div className="account-menu-profile">
                <span className="account-avatar" style={user?.imageUrl ? { backgroundImage: `url("${user.imageUrl}")` } : undefined}>{user?.imageUrl ? null : initials}</span>
                <div>
                  <strong>{displayName}</strong>
                  <span>{email}</span>
                </div>
              </div>
              <div className="account-menu-section">
                <span className="account-menu-label">Appearance</span>
                <div className="appearance-switch" role="group" aria-label="Color theme">
                  <button type="button" className={theme === "light" ? "appearance-option appearance-option-active" : "appearance-option"} onClick={() => theme !== "light" && toggleTheme()}>
                    <Sun size={15} /> Light {theme === "light" && <Check size={13} />}
                  </button>
                  <button type="button" className={theme === "dark" ? "appearance-option appearance-option-active" : "appearance-option"} onClick={() => theme !== "dark" && toggleTheme()}>
                    <Moon size={15} /> Dark {theme === "dark" && <Check size={13} />}
                  </button>
                </div>
              </div>
              <button className="account-logout" type="button" disabled={isSigningOut} onClick={() => void handleSignOut()}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
          <button className="sidebar-footer" type="button" onClick={() => { setAccountMenuOpen((current) => !current); setRecentsOpen(false); }} aria-expanded={accountMenuOpen} aria-haspopup="dialog">
            <span className="account-avatar account-avatar-small" style={user?.imageUrl ? { backgroundImage: `url("${user.imageUrl}")` } : undefined}>{user?.imageUrl ? null : initials}</span>
            <span className="profile-copy"><strong>{displayName}</strong></span>
            <ChevronUp size={16} className={accountMenuOpen ? "account-chevron account-chevron-open" : "account-chevron"} />
          </button>
        </div>
      </aside>
    </>
  );
}


function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`message-row ${isAssistant ? "message-row-assistant" : "message-row-user"}`}>
      {isAssistant && <span className="assistant-signature"><AssistantMark small /></span>}
      <div className={`message-bubble ${isAssistant ? "message-bubble-assistant" : "message-bubble-user"}`}>
        {isAssistant ? (
          <MedicalAnswer content={message.content} sources={message.metadata?.sources} />
        ) : (
          <p>{message.content}</p>
        )}
        <span className="message-time">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}


export default function ChatWorkspace() {
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
  const [dictationSupported, setDictationSupported] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTranscript, setDictationTranscript] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const dictationTranscriptRef = useRef("");
  const dictationBaseRef = useRef("");
  const dictationActionRef = useRef<"accept" | "cancel" | null>(null);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("kio-sidebar-collapsed") === "true");
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    setDictationSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("kio-sidebar-collapsed", String(next));
      return next;
    });
  }

  const token = useCallback(async () => {
    const value = await getToken();
    if (!value) throw new Error("Your session has expired. Please sign in again.");
    return value;
  }, [getToken]);

  const refreshConversations = useCallback(async () => {
    const items = await listConversations(await token());
    setConversations(items);
  }, [token]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    refreshConversations()
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load conversations."))
      .finally(() => setIsHistoryLoading(false));
  }, [isLoaded, isSignedIn, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingAnswer?.content]);

  useEffect(() => {
    if (!error) return;
    notify({ title: error, tone: "error" });
    setError("");
  }, [error, notify]);

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setStreamingAnswer(null);
    setInput("");
    setError("");
    setSidebarOpen(false);
  }

  async function selectConversation(id: string) {
    if (id === activeId || isLoading) return;
    setIsHistoryLoading(true);
    setError("");
    setMessages([]);
    setStreamingAnswer(null);
    setSidebarOpen(false);
    try {
      const conversation = await getConversation(await token(), id);
      setActiveId(conversation.id);
      setMessages(conversation.messages);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load the conversation.");
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
      await deleteConversation(await token(), id);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (id === activeId) startNewChat();
      notify({ title: "Conversation deleted", tone: "success" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the conversation.");
    } finally {
      setDeletingId(null);
    }
  }

  async function submitMessage(text = input) {
    const question = text.trim();
    if (!question || isLoading) return;

    if (isDictating) cancelDictation();
    setInput("");
    setError("");
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
        const revealCount = Math.min(remaining, Math.max(2, Math.min(24, Math.ceil(remaining / 8))));
        displayedLength += revealCount;
        const visibleContent = streamedContent.slice(0, displayedLength);
        setStreamingAnswer((current) => current ? { ...current, content: visibleContent } : current);
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
        const created = await createConversation(authToken);
        conversationId = created.id;
        setActiveId(created.id);
        setConversations((current) => [created, ...current]);
      }
      const result = await streamMessage(authToken, conversationId, question, {
        onStart: (event) => {
          setMessages((current) => [
            ...current.filter(
              (message) => message.id !== optimisticId && message.id !== event.userMessage.id,
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
      });
      streamFinished = true;
      schedulePresentation();
      await presentationDone;
      setMessages((current) => [
        ...current.filter(
          (message) =>
            message.id !== optimisticId
            && message.id !== result.userMessage.id
            && message.id !== result.assistantMessage.id,
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
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setStreamingAnswer(null);
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  function startDictation() {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const phrases: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        phrases.push(result[0].transcript.trim());
      }
      const transcript = phrases.filter(Boolean).join(" ");
      dictationTranscriptRef.current = transcript;
      setDictationTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setIsDictating(false);
      if (event.error === "not-allowed") setError("Microphone access is required to use dictation.");
    };
    recognition.onend = () => {
      if (dictationActionRef.current !== "cancel") {
        const transcript = dictationTranscriptRef.current.trim();
        if (transcript) {
          const base = dictationBaseRef.current;
          setInput(`${base}${base && !base.endsWith(" ") ? " " : ""}${transcript}`);
        }
      }
      recognitionRef.current = null;
      dictationActionRef.current = null;
      setIsDictating(false);
    };
    recognitionRef.current = recognition;
    dictationBaseRef.current = input;
    dictationTranscriptRef.current = "";
    dictationActionRef.current = null;
    setDictationTranscript("");
    setError("");
    setIsDictating(true);
    try {
      recognition.start();
    } catch {
      setIsDictating(false);
    }
  }

  function acceptDictation() {
    dictationActionRef.current = "accept";
    recognitionRef.current?.stop();
  }

  function cancelDictation() {
    dictationActionRef.current = "cancel";
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setDictationTranscript("");
    setIsDictating(false);
  }

  const hasConversation = messages.length > 0 || isHistoryLoading;
  return (
    <main className="app-shell">
      <Sidebar
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
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="app-title">KIO Medical AI <ChevronDown size={15} /></div>
          <div className="topbar-actions">
            <span className="clinical-status"><ShieldCheck size={14} /> Private clinical conversation</span>
            <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className={`conversation ${hasConversation ? "conversation-active" : ""}`}>
          {!hasConversation ? (
            <div className="welcome-panel">
              <h1>How can I help, {user?.firstName || user?.fullName?.split(" ")[0] || "there"}?</h1>
              <p className="welcome-copy">Share what you are experiencing. Kio will organize the details and offer a clear, evidence-grounded next step.</p>
              <div className="prompt-grid">
                {starterPrompts.map((prompt, index) => {
                  const PromptIcon = [HeartPulse, MoonStar, Thermometer, ShieldCheck][index] || Stethoscope;
                  return (
                    <button className="prompt-card" key={prompt} onClick={() => void submitMessage(prompt)}>
                      <span className={`prompt-icon prompt-icon-${index}`}><PromptIcon size={17} /></span>
                      <span>{prompt}</span>
                    </button>
                  );
                })}
              </div>
              <div className="medical-assurance">
                <span><ShieldCheck size={14} /> Private by design</span>
                <span><Stethoscope size={14} /> Built for informed care conversations</span>
              </div>
            </div>
          ) : (
            <div className="message-list">
              {isHistoryLoading && <div className="history-loading"><KioLoadingIndicator size="section" label="Loading conversation..." /></div>}
              {messages.map((message) => <MessageBubble message={message} key={message.id} />)}
              {isLoading && <div className="message-row message-row-assistant agent-loader-row"><KioAgentLoader /></div>}
              {streamingAnswer?.content && <MessageBubble message={streamingAnswer} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={handleSubmit}>
            <button type="button" className="composer-tool" disabled aria-label="Attachments are coming soon" title="Attachments are coming soon"><Paperclip size={19} /></button>
            {isDictating ? (
              <div className="dictation-session" role="status" aria-live="polite">
                <div className="dictation-waveform" aria-hidden="true">
                  {Array.from({ length: 48 }, (_, index) => (
                    <span key={index} style={{ height: `${18 + ((index * 17) % 64)}%`, animationDelay: `${-index * 34}ms` }} />
                  ))}
                </div>
                <span className="sr-only">{dictationTranscript || "Listening"}</span>
                <button className="dictation-cancel" type="button" onClick={cancelDictation} aria-label="Cancel dictation" title="Cancel dictation"><X size={20} /></button>
                <button className="dictation-accept" type="button" onClick={acceptDictation} aria-label="Use transcription" title="Use transcription"><Check size={21} /></button>
              </div>
            ) : (
              <>
                <textarea value={input} maxLength={8000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }} placeholder="Ask anything about your health..." rows={1} />
                <button type="button" className="dictate-button" onClick={startDictation} disabled={!dictationSupported || isLoading} aria-label="Dictate message" title={dictationSupported ? "Dictate message" : "Dictation is not supported by this browser"}><Mic size={19} /></button>
                <button type="submit" className="send-button" disabled={isLoading} aria-label={isLoading ? "Sending message" : "Send message"}>
                  <Send size={18} />
                </button>
              </>
            )}
          </form>
          <p className="composer-note">Kio can make mistakes. This is not a substitute for professional medical advice.</p>
        </div>
      </section>
    </main>
  );
}
