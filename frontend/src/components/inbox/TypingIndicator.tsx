"use client";
import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-center gap-2 px-2 py-1"
    >
      <div
        className="flex items-end gap-1 px-4 py-2.5 rounded-2xl rounded-bl-sm"
        style={{ background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-2 w-2 rounded-full"
            style={{ background: "#c0c3d6" }}
            animate={{ y: ["0%", "-40%", "0%"] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <span className="text-xs" style={{ color: "#b0b3c6" }}>typing…</span>
    </motion.div>
  );
}
