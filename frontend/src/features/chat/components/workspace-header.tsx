"use client";

import { ChevronDown, Menu, Moon, ShieldCheck, Sun } from "lucide-react";

import type { ChatController } from "../hooks/use-chat-controller";

type Props = Pick<
  ChatController,
  "setSidebarOpen" | "isGuest" | "toggleTheme" | "theme"
>;

export default function WorkspaceHeader({
  setSidebarOpen,
  isGuest,
  toggleTheme,
  theme,
}: Props) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="app-title">
        KIO Medical AI <ChevronDown size={15} />
      </div>
      <div className="topbar-actions">
        <span className="clinical-status">
          <ShieldCheck size={14} />{" "}
          {isGuest ? "Guest conversation" : "Private clinical conversation"}
        </span>
        <button
          className="icon-button theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
