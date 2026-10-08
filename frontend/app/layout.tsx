import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { KioThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";

export const metadata = {
  title: "KIO Medical AI | Autonomous Clinical Reasoning",
  description: "Enterprise clinical reasoning infrastructure driven by molecular agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body><ClerkProvider><KioThemeProvider><ToastProvider>{children}</ToastProvider></KioThemeProvider></ClerkProvider></body>
    </html>
  );
}
