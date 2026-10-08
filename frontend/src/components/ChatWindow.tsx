import React from 'react';
import { Sparkles, Activity, ShieldAlert, HeartPulse, Pill, Stethoscope, Search, Dna } from 'lucide-react';
import { Message } from '../types/chat';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const suggestions = [
  { text: 'Common cold symptoms', icon: Stethoscope },
  { text: 'How does diabetes affect the body?', icon: Dna },
  { text: 'Side effects of ibuprofen', icon: Pill },
  { text: 'Heart healthy exercises', icon: HeartPulse },
  { text: 'First aid for minor burns', icon: ShieldAlert },
  { text: 'What is hypertension?', icon: Activity }
];

export default function ChatWindow({ messages, onSendMessage, isLoading, activeTab, onTabChange }: ChatWindowProps) {
  const tabs = ['Dashboard', 'AI Chatbot', 'Help', 'Labs'];

  return (
    <main className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden text-slate-100">
      
      {/* Top Navigation Bar */}
      <header className="h-20 border-b border-slate-900 px-8 flex items-center justify-between shrink-0 bg-slate-950/80 backdrop-blur-md">
        
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                tab === activeTab
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Profile Status Widgets */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Health Monitor Active</span>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-slate-950">
              JM
            </div>
            <span className="text-xs font-semibold text-slate-300 select-all">JackMatrix_382x</span>
          </div>
        </div>
      </header>

      {/* Main Message Space */}
      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6 scrollbar-thin">
        {messages.length === 0 ? (
          
          /* Welcome/Intro State */
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center gap-8 py-12">
            
            {/* Soft Glowing Pulsing Logo/Icon */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-32 h-32 rounded-full bg-emerald-500/10 blur-xl animate-pulse" />
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg relative z-10">
                <Sparkles size={36} />
              </div>
            </div>

            {/* Welcome Typography */}
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Hey, I&apos;m <span className="text-emerald-400 font-black">sorin</span>. How can I help you today?
              </h2>
              <p className="text-slate-400 text-sm max-w-lg mx-auto font-medium">
                I am your specialized medical intelligence chatbot. Ask me about medications, health symptoms, or first aid using context from the medical library.
              </p>
            </div>

            {/* Suggestion Chips */}
            <div className="w-full space-y-3 pt-4">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-widest">Suggested Queries</span>
              <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
                {suggestions.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(s.text)}
                      className="flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700/80 rounded-xl text-left text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-800/85 flex items-center justify-center text-emerald-400">
                        <Icon size={14} />
                      </div>
                      <span className="truncate">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          
          /* Message History Feed */
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 max-w-[85%] ${
                  message.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                    message.sender === 'user'
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold text-xs'
                      : 'bg-slate-900 border-slate-800 text-emerald-400'
                  }`}
                >
                  {message.sender === 'user' ? 'U' : <Sparkles size={16} />}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed border shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  {message.text}
                  <span className="block text-[10px] text-slate-500 mt-2 font-medium">
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Loader Indicator */}
            {isLoading && (
              <div className="flex gap-4 mr-auto max-w-[85%] animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles size={16} className="animate-spin" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex gap-1.5 items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Box Footer Section */}
      <footer className="p-8 border-t border-slate-900 shrink-0 bg-slate-950/80 backdrop-blur-md flex flex-col gap-6">
        <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
        
        {/* App Integration Badges */}
        <div className="flex flex-col gap-3 items-center justify-center text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600 tracking-widest">Connected Integrations</span>
          <div className="flex items-center gap-4 bg-slate-900/30 px-4 py-2 rounded-full border border-slate-900/60">
            <span className="text-xs text-slate-500 font-semibold px-1">Official Bots:</span>
            {['GitHub', 'Discord', 'MetaMask', 'Google'].map((bot, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-600 transition-all cursor-pointer"
                title={`${bot} Connection`}
              >
                {bot[0]}
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
