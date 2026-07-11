"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent, wallpaper, fontSize } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const applyMode = () => {
      const isDark = mode === "dark" || (mode === "system" && mq.matches);
      root.classList.toggle("dark", isDark);
    };
    applyMode();
    if (mode === "system") {
      mq.addEventListener("change", applyMode);
      return () => mq.removeEventListener("change", applyMode);
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute("data-wallpaper", wallpaper);
  }, [wallpaper]);

  useEffect(() => {
    document.documentElement.setAttribute("data-fontsize", fontSize);
  }, [fontSize]);

  return <>{children}</>;
}
