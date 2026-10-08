"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type KioTheme = "dark" | "light";

const ThemeContext = createContext<{
  theme: KioTheme;
  toggleTheme: () => void;
} | null>(null);

export function KioThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<KioTheme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("kio-theme");
    const initialTheme: KioTheme = saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("kio-theme", nextTheme);
      return nextTheme;
    }),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useKioTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useKioTheme must be used within KioThemeProvider");
  return context;
}
