"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type ToastTone = "error" | "info" | "success";

type ToastAction = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
  actions?: ToastAction[];
  onDismiss?: () => void;
};

type ToastInput = Omit<ToastItem, "id">;

const ToastContext = createContext<{
  notify: (toast: Partial<ToastInput> & Pick<ToastInput, "title">) => void;
  confirm: (options: { title: string; description?: string; confirmLabel?: string; duration?: number }) => Promise<boolean>;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());
  const dismissCallbacks = useRef(new Map<string, () => void>());

  const dismiss = useCallback((id: string, runDismiss = true) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    const onDismiss = dismissCallbacks.current.get(id);
    dismissCallbacks.current.delete(id);
    if (runDismiss) onDismiss?.();
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const toast = { ...input, id };
    if (input.onDismiss) dismissCallbacks.current.set(id, input.onDismiss);
    setToasts((current) => [...current, toast]);
    const timer = window.setTimeout(() => dismiss(id), input.duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const notify = useCallback((input: Partial<ToastInput> & Pick<ToastInput, "title">) => {
    push({
      title: input.title,
      description: input.description,
      tone: input.tone || "info",
      duration: input.duration || 4200,
      actions: input.actions,
      onDismiss: input.onDismiss,
    });
  }, [push]);

  const confirm = useCallback((options: { title: string; description?: string; confirmLabel?: string; duration?: number }) => (
    new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      push({
        title: options.title,
        description: options.description,
        tone: "info",
        duration: options.duration || 10000,
        actions: [
          { label: "Cancel", onClick: () => settle(false) },
          { label: options.confirmLabel || "Confirm", destructive: true, onClick: () => settle(true) },
        ],
        onDismiss: () => settle(false),
      });
    })
  ), [push]);

  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CircleCheck : toast.tone === "error" ? CircleAlert : Info;
          return (
            <section className={`app-toast app-toast-${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"} style={{ "--toast-duration": `${toast.duration}ms` } as React.CSSProperties}>
              <Icon className="toast-icon" size={19} />
              <div className="toast-content">
                <strong>{toast.title}</strong>
                {toast.description && <p>{toast.description}</p>}
                {toast.actions && (
                  <div className="toast-actions">
                    {toast.actions.map((action) => (
                      <button
                        type="button"
                        className={action.destructive ? "toast-action toast-action-destructive" : "toast-action"}
                        key={action.label}
                        onClick={() => {
                          dismiss(toast.id, false);
                          action.onClick();
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="toast-close" type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={16} /></button>
              <span className="toast-timer" />
            </section>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
