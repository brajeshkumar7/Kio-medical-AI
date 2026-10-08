import React from 'react';
import { PlusCircle, SquarePen, Calendar, Briefcase, Activity, Folder, User, ChevronDown } from 'lucide-react';
import { ChatSession } from '../types/chat';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewChat }: SidebarProps) {
  // Group sessions by dateGroup
  const groupedSessions = sessions.reduce((acc, session) => {
    if (!acc[session.dateGroup]) {
      acc[session.dateGroup] = [];
    }
    acc[session.dateGroup].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col h-full overflow-hidden select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-850">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
            <PlusCircle size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Sorin-AI</h1>
            <p className="text-xs text-slate-400 font-medium">Assistant Dashboard</p>
          </div>
        </div>
      </div>

      {/* New Chat Action */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-755 border border-slate-700/50 hover:border-slate-600 rounded-xl flex items-center justify-center gap-2 text-white font-medium transition-all shadow-sm group active:scale-[0.98]"
        >
          <SquarePen size={18} className="text-emerald-400 group-hover:rotate-6 transition-transform" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Static Menu Option list */}
      <div className="px-4 py-2 flex flex-col gap-1">
        <span className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dashboard Navigation</span>
        <button className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm font-medium transition-all">
          <Calendar size={18} className="text-slate-500" />
          <span>Market Daily</span>
        </button>
        <button className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm font-medium transition-all">
          <Briefcase size={18} className="text-slate-500" />
          <span>My Portfolio</span>
        </button>
        <button className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm font-medium transition-all">
          <Activity size={18} className="text-slate-500" />
          <span>My Monitor</span>
        </button>
        <button className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm font-medium transition-all">
          <Folder size={18} className="text-slate-500" />
          <span>My Project</span>
        </button>
      </div>

      {/* Chat History Sessions list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {Object.entries(groupedSessions).map(([groupName, groupSessions]) => (
          <div key={groupName} className="space-y-1">
            <span className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
              {groupName}
            </span>
            {groupSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-medium transition-all truncate block ${
                  session.id === activeSessionId
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                }`}
              >
                {session.title || 'Untitled Chat'}
              </button>
            ))}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">No recent chats</p>
        )}
      </div>

      {/* Profile Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700/80 border border-slate-605 flex items-center justify-center text-white overflow-hidden">
            <User size={20} className="text-slate-300" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-white leading-tight">Jack Matrix</span>
            <span className="text-xs text-slate-500 font-medium">jackmatrix@gmail.com</span>
          </div>
        </div>
        <button className="text-slate-400 hover:text-white transition-colors">
          <ChevronDown size={18} />
        </button>
      </div>
    </aside>
  );
}
