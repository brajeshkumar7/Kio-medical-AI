"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { KioThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <KioThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </KioThemeProvider>
    </ClerkProvider>
  );
}
