"use client";

import { KioAnimatedMark } from "@/components/brand/kio-agent-loader";
import { Conversation } from "@/features/chat/types";
import { useKioTheme } from "@/providers/theme-provider";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Check,
  ChevronUp,
  Clock3,
  LogOut,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import AssistantMark from "./assistant-mark";

export default function Sidebar({
  guest,
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
  guest: boolean;
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
  const displayName = guest
    ? "Guest"
    : user?.fullName || user?.firstName || "Kio user";
  const email = guest
    ? "Sign in to keep your chats"
    : user?.primaryEmailAddress?.emailAddress || "Signed in";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    function closeAccountMenu(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
      if (!recentsRef.current?.contains(event.target as Node))
        setRecentsOpen(false);
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
      {open && (
        <button
          className="sidebar-scrim"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}
      {searchOpen && (
        <div
          className="search-modal-backdrop"
          onMouseDown={() => setSearchOpen(false)}
        >
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search conversations"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="search-modal-input">
              <Search size={20} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X size={19} />
              </button>
            </div>
            <div className="search-modal-results">
              <div className="search-modal-label">
                {searchQuery.trim() ? "Search results" : "Recent chats"}
              </div>
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
                <div className="search-empty">
                  <Search size={20} />
                  <span>No matching conversations</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      <aside
        className={`sidebar ${open ? "sidebar-open" : ""} ${compact ? "sidebar-collapsed" : ""}`}
      >
        {compact ? (
          <>
            <button
              className="rail-logo-button"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <span className="rail-logo-mark">
                <AssistantMark />
              </span>
              <span className="rail-logo-open">
                <PanelLeftOpen size={20} />
              </span>
            </button>
            <div className="rail-actions">
              <button
                className="icon-button rail-action"
                type="button"
                onClick={onNewChat}
                aria-label="New chat"
                title="New chat"
              >
                <SquarePen size={20} />
              </button>
              <button
                className="icon-button rail-action"
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search conversations"
                title="Search conversations"
              >
                <Search size={20} />
              </button>
              <div className="rail-recents-control" ref={recentsRef}>
                <button
                  className={`icon-button rail-action ${recentsOpen ? "rail-action-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setRecentsOpen((current) => !current);
                    setAccountMenuOpen(false);
                  }}
                  aria-label="Recent conversations"
                  title="Recent conversations"
                >
                  <MessageCircle size={20} />
                </button>
                {recentsOpen && (
                  <div className="rail-recents-popover">
                    <strong>Recents</strong>
                    <div>
                      {conversations.map((conversation) => (
                        <div className="rail-recent-row" key={conversation.id}>
                          <button
                            type="button"
                            className={
                              activeId === conversation.id
                                ? "rail-recent-item rail-recent-item-active"
                                : "rail-recent-item"
                            }
                            title={conversation.title}
                            onClick={() => {
                              onSelect(conversation.id);
                              setRecentsOpen(false);
                            }}
                          >
                            {conversation.title}
                          </button>
                          <button
                            className={`rail-recent-delete ${deletingId === conversation.id ? "delete-pending" : ""}`}
                            type="button"
                            disabled={deletingId === conversation.id}
                            onClick={() => onDelete(conversation.id)}
                            aria-label={`Delete ${conversation.title}`}
                            title="Delete conversation"
                          >
                            {deletingId === conversation.id ? (
                              <KioAnimatedMark size={30} label="" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      ))}
                      {conversations.length === 0 && (
                        <span className="rail-recents-empty">
                          No conversations yet
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="brand-row">
              <div className="brand-lockup">
                <AssistantMark />
              </div>
              <div className="sidebar-header-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search conversations"
                  title="Search conversations"
                >
                  <Search size={19} />
                </button>
                <button
                  className="icon-button sidebar-collapse"
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Hide sidebar"
                  title="Hide sidebar"
                >
                  <PanelLeftClose size={18} />
                </button>
                <button
                  className="icon-button sidebar-close"
                  type="button"
                  onClick={onClose}
                  aria-label="Close sidebar"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
            </div>

            <button
              className={`new-chat-button ${activeId === null ? "new-chat-button-active" : ""}`}
              onClick={onNewChat}
            >
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
                    <button
                      className={`session-delete ${deletingId === conversation.id ? "delete-pending" : ""}`}
                      type="button"
                      disabled={deletingId === conversation.id}
                      onClick={() => onDelete(conversation.id)}
                      aria-label={`Delete ${conversation.title}`}
                      title="Delete conversation"
                    >
                      {deletingId === conversation.id ? (
                        <KioAnimatedMark size={30} label="" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="empty-history">
                    <Clock3 size={15} />
                    <span>No conversations yet</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {guest ? (
          <div
            className={`account-control ${compact ? "account-control-collapsed" : ""}`}
          >
            <Link className="sidebar-footer" href="/" title="Sign in">
              <span className="account-avatar account-avatar-small">G</span>
              <span className="profile-copy">
                <strong>Sign in</strong>
              </span>
            </Link>
          </div>
        ) : (
          <div
            className={`account-control ${compact ? "account-control-collapsed" : ""}`}
            ref={accountMenuRef}
          >
            {accountMenuOpen && (
              <div
                className="account-menu"
                role="dialog"
                aria-label="Account settings"
              >
                <div className="account-menu-profile">
                  <span
                    className="account-avatar"
                    style={
                      user?.imageUrl
                        ? { backgroundImage: `url("${user.imageUrl}")` }
                        : undefined
                    }
                  >
                    {user?.imageUrl ? null : initials}
                  </span>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{email}</span>
                  </div>
                </div>
                <div className="account-menu-section">
                  <span className="account-menu-label">Appearance</span>
                  <div
                    className="appearance-switch"
                    role="group"
                    aria-label="Color theme"
                  >
                    <button
                      type="button"
                      className={
                        theme === "light"
                          ? "appearance-option appearance-option-active"
                          : "appearance-option"
                      }
                      onClick={() => theme !== "light" && toggleTheme()}
                    >
                      <Sun size={15} /> Light{" "}
                      {theme === "light" && <Check size={13} />}
                    </button>
                    <button
                      type="button"
                      className={
                        theme === "dark"
                          ? "appearance-option appearance-option-active"
                          : "appearance-option"
                      }
                      onClick={() => theme !== "dark" && toggleTheme()}
                    >
                      <Moon size={15} /> Dark{" "}
                      {theme === "dark" && <Check size={13} />}
                    </button>
                  </div>
                </div>
                <button
                  className="account-logout"
                  type="button"
                  disabled={isSigningOut}
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
            <button
              className="sidebar-footer"
              type="button"
              onClick={() => {
                setAccountMenuOpen((current) => !current);
                setRecentsOpen(false);
              }}
              aria-expanded={accountMenuOpen}
              aria-haspopup="dialog"
            >
              <span
                className="account-avatar account-avatar-small"
                style={
                  user?.imageUrl
                    ? { backgroundImage: `url("${user.imageUrl}")` }
                    : undefined
                }
              >
                {user?.imageUrl ? null : initials}
              </span>
              <span className="profile-copy">
                <strong>{displayName}</strong>
              </span>
              <ChevronUp
                size={16}
                className={
                  accountMenuOpen
                    ? "account-chevron account-chevron-open"
                    : "account-chevron"
                }
              />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
