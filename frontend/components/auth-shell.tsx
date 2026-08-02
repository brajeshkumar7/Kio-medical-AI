"use client";

import { Moon, ShieldCheck, Stethoscope, Sun } from "lucide-react";
import AuthCareSignal from "@/components/auth-care-signal";
import KioBrandMark from "@/components/kio-brand";
import { useKioTheme } from "@/components/theme-provider";


export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useKioTheme();

  return (
    <main className="auth-page">
      <button className="icon-button auth-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <KioBrandMark size={40} />
          <span><strong>KIO</strong><small>MEDICAL AI</small></span>
        </div>
        <div className="auth-message">
          <span className="auth-eyebrow"><Stethoscope size={15} /> Your health workspace</span>
          <h1>Care context.<br /><em>Kept together.</em></h1>
          <p>Return to your health questions, previous guidance, and the details that matter without starting over.</p>
        </div>
        <AuthCareSignal />
        <div className="auth-trust"><ShieldCheck size={16} /><span>Secure account access powered by Clerk</span></div>
      </section>
      <section className="auth-form-panel">
        {children}
      </section>
    </main>
  );
}
