"use client";

import { X, Monitor, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore, type ThemeMode, type AccentColor, type Wallpaper, type FontSize } from "@/store/theme-store";
import { cn } from "@/shared/lib/utils";

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

const MODES: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark",  label: "Dark",  icon: <Moon className="h-4 w-4" /> },
  { value: "system",label: "System",icon: <Monitor className="h-4 w-4" /> },
];

const ACCENTS: { value: AccentColor; color: string; label: string }[] = [
  { value: "green",  color: "#00a884", label: "WhatsApp" },
  { value: "purple", color: "#7c3aed", label: "Purple"   },
  { value: "blue",   color: "#2563eb", label: "Blue"     },
  { value: "pink",   color: "#db2777", label: "Pink"     },
  { value: "orange", color: "#ea580c", label: "Orange"   },
];

const WALLPAPERS: { value: Wallpaper; label: string; preview: string }[] = [
  { value: "default",       label: "Default",      preview: "bg-[#efeae2]" },
  { value: "dots",          label: "Dots",         preview: "bg-[#f0f4f8]" },
  { value: "leaves",        label: "Leaves",       preview: "bg-[#e8f5e9]" },
  { value: "waves",         label: "Waves",        preview: "bg-[#e3f2fd]" },
  { value: "solid-light",   label: "Light",        preview: "bg-[#f5f5f5]" },
  { value: "solid-dark",    label: "Dark",         preview: "bg-[#2c2c2c]" },
  { value: "gradient-blue", label: "Blue Grad",    preview: "bg-gradient-to-br from-blue-100 to-purple-100" },
  { value: "gradient-pink", label: "Pink Grad",    preview: "bg-gradient-to-br from-pink-100 to-yellow-100" },
  { value: "none",          label: "None",         preview: "bg-background border border-border" },
];

const FONT_SIZES: { value: FontSize; label: string; size: string }[] = [
  { value: "small",  label: "Small",  size: "text-xs" },
  { value: "medium", label: "Medium", size: "text-sm" },
  { value: "large",  label: "Large",  size: "text-base" },
];

export function ThemePanel({ open, onClose }: ThemePanelProps) {
  const { mode, accent, wallpaper, fontSize, setMode, setAccent, setWallpaper, setFontSize } = useThemeStore();

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-16 lg:left-56 top-0 h-screen w-80 z-50 bg-white dark:bg-[#111b21] border-r border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
              <h2 className="font-semibold text-base">Appearance</h2>
              <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-7">

              {/* Mode */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Theme Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map(({ value, label, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-medium transition-all",
                        mode === value
                          ? "border-[var(--wa-accent)] bg-[var(--wa-accent)]/10 text-[var(--wa-accent)]"
                          : "border-border hover:border-[var(--wa-accent)]/50 text-muted-foreground"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Accent Color */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accent Color</p>
                <div className="flex gap-3 flex-wrap">
                  {ACCENTS.map(({ value, color, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAccent(value)}
                      title={label}
                      className={cn(
                        "h-9 w-9 rounded-full border-4 transition-all hover:scale-110",
                        accent === value ? "border-gray-400 dark:border-gray-300 scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {ACCENTS.find((a) => a.value === accent)?.label}
                </p>
              </section>

              {/* Wallpaper */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chat Wallpaper</p>
                <div className="grid grid-cols-3 gap-2">
                  {WALLPAPERS.map(({ value, label, preview }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWallpaper(value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 overflow-hidden transition-all",
                        wallpaper === value
                          ? "border-[var(--wa-accent)]"
                          : "border-border hover:border-[var(--wa-accent)]/50"
                      )}
                    >
                      <div className={cn("w-full h-12", preview)} />
                      <span className="text-[10px] font-medium text-muted-foreground pb-1.5">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Font Size */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Message Font Size</p>
                <div className="grid grid-cols-3 gap-2">
                  {FONT_SIZES.map(({ value, label, size }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFontSize(value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all",
                        fontSize === value
                          ? "border-[var(--wa-accent)] bg-[var(--wa-accent)]/10 text-[var(--wa-accent)]"
                          : "border-border hover:border-[var(--wa-accent)]/50 text-muted-foreground"
                      )}
                    >
                      <span className={cn("font-semibold", size)}>Aa</span>
                      <span className="text-[10px]">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Live preview */}
                <div className="mt-3 rounded-xl bg-[#d9fdd3] dark:bg-[#005c4b] px-3 py-2 shadow-sm">
                  <p style={{ fontSize: "var(--wa-msg-font)" }} className="text-gray-800 dark:text-gray-100 leading-relaxed">
                    Preview message text 👋
                  </p>
                  <p className="text-[10px] text-gray-400 text-right mt-0.5">12:34</p>
                </div>
              </section>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
