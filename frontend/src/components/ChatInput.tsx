import React, { useState, useRef, useEffect } from 'react';
import { Plus, Send, Sparkles, FileText, Settings } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-2xl bg-slate-900 border border-slate-800 shadow-xl focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all p-3 flex flex-col gap-2">
        
        {/* Main Textarea Input */}
        <div className="flex gap-2 items-start">
          <button
            type="button"
            className="mt-1.5 w-8 h-8 rounded-full bg-slate-800 border border-slate-700/60 hover:bg-slate-700 hover:border-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Plus size={18} />
          </button>
          
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about medical health, medications, symptoms, and more..."
            className="flex-1 w-full bg-transparent border-0 outline-0 ring-0 text-white placeholder-slate-500 text-sm py-2 resize-none max-h-48 overflow-y-auto leading-relaxed focus:outline-none focus:ring-0"
            style={{ height: '38px' }}
          />
        </div>

        {/* Action Controls Footer Row */}
        <div className="flex items-center justify-between border-t border-slate-850 pt-2.5 mt-1">
          <div className="flex items-center gap-2">
            
            {/* "Auto" mode pill */}
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all"
            >
              <Sparkles size={13} />
              <span>Auto</span>
            </button>
            
            {/* Quick helper buttons */}
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
              title="Add document context"
            >
              <FileText size={16} />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
              title="Chat Settings"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || isLoading}
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 font-semibold text-sm transition-all shadow-md active:scale-[0.97] cursor-pointer ${
              text.trim() && !isLoading
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Send</span>
            <Send size={14} />
          </button>
        </div>
      </div>
    </form>
  );
}
