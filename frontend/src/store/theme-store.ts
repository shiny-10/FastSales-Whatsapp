import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "green" | "purple" | "blue" | "pink" | "orange";
export type Wallpaper = "default" | "dots" | "leaves" | "waves" | "solid-light" | "solid-dark" | "gradient-blue" | "gradient-pink" | "none";
export type FontSize = "small" | "medium" | "large";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  wallpaper: Wallpaper;
  fontSize: FontSize;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setWallpaper: (wallpaper: Wallpaper) => void;
  setFontSize: (fontSize: FontSize) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accent: "purple",
      wallpaper: "default",
      fontSize: "medium",
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: "wa-theme" }
  )
);
