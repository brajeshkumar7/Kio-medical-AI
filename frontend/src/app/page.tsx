'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { Message, ChatSession } from '../types/chat';

// Generate safe unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// API Base URL config
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('AI Chatbot');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize with a default session if empty
  useEffect(() => {
    // Attempt to load from localStorage
    const saved = localStorage.getItem('sorin_chat_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error('Error loading saved chat sessions:', e);
      }
    }

    // Fallback: Create first empty session
    const initialSessionId = generateId();
    const defaultSession: ChatSession = {
      id: initialSessionId,
      title: 'Common cold symptoms...',
      messages: [],
      dateGroup: 'Today',
    };
    setSessions([defaultSession]);
    setActiveSessionId(initialSessionId);
  }, []);

  // Sync sessions to localStorage
  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem('sorin_chat_sessions', JSON.stringify(updatedSessions));
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleSendMessage = async (text: string) => {
    if (!activeSessionId) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 1. Create User Message
    const userMessage: Message = {
      id: generateId(),
      sender: 'user',
      text,
      timestamp,
    };

    // 2. Update session with User Message
    let updatedSessions = sessions.map((session) => {
      if (session.id === activeSessionId) {
        const title = session.messages.length === 0 ? (text.length > 28 ? text.substring(0, 28) + '...' : text) : session.title;
        return {
          ...session,
          title,
          messages: [...session.messages, userMessage],
        };
      }
      return session;
    });

    saveSessions(updatedSessions);
    setIsLoading(true);

    try {
      // 3. Post to Flask API Backend
      const formData = new FormData();
      formData.append('msg', text);

      const response = await fetch(`${API_BASE_URL}/get`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      let botText = '';

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        botText = data.answer || 'No response returned from the AI model.';
      } else {
        // Fallback to plain text
        botText = await response.text();
      }

      // 4. Create Bot Message
      const botMessage: Message = {
        id: generateId(),
        sender: 'bot',
        text: botText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // 5. Update session with Bot response
      updatedSessions = updatedSessions.map((session) => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, botMessage],
          };
        }
        return session;
      });

      saveSessions(updatedSessions);
    } catch (error) {
      console.error('[Chat] Fetch error:', error);
      
      const errorMessage: Message = {
        id: generateId(),
        sender: 'bot',
        text: 'Sorry, I am unable to connect to the medical assistant service at the moment. Please verify your backend server is active at localhost:8080.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      updatedSessions = updatedSessions.map((session) => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage],
          };
        }
        return session;
      });

      saveSessions(updatedSessions);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const newId = generateId();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat Session',
      messages: [],
      dateGroup: 'Today',
    };
    saveSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />
      <ChatWindow
        messages={activeSession?.messages || []}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
