import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

export const metadata = {
  title: "KIO Medical AI | Autonomous Clinical Reasoning",
  description:
    "Enterprise clinical reasoning infrastructure driven by molecular agents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
