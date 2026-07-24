"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Bell, ChevronDown, MessageSquare, X, CheckCheck, User, FileText, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useInboxStore } from "@/store/inbox-store";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type SearchResult = {
  id: string;
  type: "contact" | "conversation" | "template" | "campaign";
  title: string;
  subtitle?: string;
  href: string;
  conversationId?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── Search Bar ─────────────────────────────────────────────────────────────── */
function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 280);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    setCursor(-1);

    Promise.allSettled([
      api.get("/api/contacts", { params: { q: debouncedQuery, limit: 4 } }),
      api.get("/inbox/conversations", { params: { search: debouncedQuery, page_size: 4 } }),
      api.get("/api/templates", {}),
    ]).then(([contactsRes, convsRes, templatesRes]) => {
      const out: SearchResult[] = [];

      // Contacts
      if (contactsRes.status === "fulfilled") {
        const items: any[] = Array.isArray(contactsRes.value.data)
          ? contactsRes.value.data
          : contactsRes.value.data?.contacts ?? contactsRes.value.data?.items ?? [];
        items.slice(0, 4).forEach((c: any) => {
          if (
            c.name?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            c.phone_number?.includes(debouncedQuery)
          ) {
            out.push({
              id: `contact-${c.id}`,
              type: "contact",
              title: c.name ?? c.phone_number,
              subtitle: c.phone_number,
              href: "/contacts",
            });
          }
        });
      }

      // Conversations
      if (convsRes.status === "fulfilled") {
        const items: any[] = convsRes.value.data?.items ?? [];
        items.slice(0, 4).forEach((c: any) => {
          out.push({
            id: `conv-${c.id}`,
            type: "conversation",
            title: c.customer_name ?? c.customer_phone,
            subtitle: c.last_message_preview ?? c.customer_phone,
            href: "/whatsapp/inbox",
            conversationId: String(c.id),
          });
        });
      }

      // Templates
      if (templatesRes.status === "fulfilled") {
        const items: any[] = Array.isArray(templatesRes.value.data)
          ? templatesRes.value.data
          : [];
        items
          .filter((t: any) =>
            t.template_name?.toLowerCase().includes(debouncedQuery.toLowerCase())
          )
          .slice(0, 3)
          .forEach((t: any) => {
            out.push({
              id: `tmpl-${t.id}`,
              type: "template",
              title: t.template_name,
              subtitle: t.category ?? "Template",
              href: "/templates",
            });
          });
      }

      setResults(out);
    }).finally(() => setLoading(false));
  }, [debouncedQuery]);

  const { setActiveConversation } = useInboxStore();

  const handleSelect = useCallback((r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (r.type === "conversation" && r.conversationId) {
      setActiveConversation(r.conversationId);
    }
    router.push(r.href);
  }, [router, setActiveConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && cursor >= 0) { e.preventDefault(); handleSelect(results[cursor]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  const iconMap = {
    contact: <User className="h-3.5 w-3.5" style={{ color: "#7c3aed" }} />,
    conversation: <MessageSquare className="h-3.5 w-3.5" style={{ color: "#06b6d4" }} />,
    template: <FileText className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />,
    campaign: <Send className="h-3.5 w-3.5" style={{ color: "#10b981" }} />,
  };

  return (
    <div className="relative w-72">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0aed0" }} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Search anything..."
        className="w-full pl-9 pr-8 py-2 text-sm rounded-full focus:outline-none placeholder:text-[#c0bed8] transition-all"
        style={{
          background: "#f5f4fb",
          border: `1px solid ${open ? "#c4b5fd" : "#e8e6f5"}`,
          color: "#1a1040",
          fontSize: "13px",
        }}
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "#b0aed0" }}
        >
          <X size={12} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-2 w-full rounded-2xl shadow-xl overflow-hidden z-50"
          style={{ background: "#fff", border: "1px solid #e8e6f5", minWidth: "300px" }}
        >
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-xs" style={{ color: "#b0aed0" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs" style={{ color: "#b0aed0" }}>No results for "{query}"</div>
          ) : (
            <>
              {/* Group by type */}
              {(["contact", "conversation", "template"] as const).map((type) => {
                const group = results.filter((r) => r.type === type);
                if (!group.length) return null;
                const labels = { contact: "Contacts", conversation: "Conversations", template: "Templates" };
                return (
                  <div key={type}>
                    <p
                      className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "#b0aed0" }}
                    >
                      {labels[type]}
                    </p>
                    {group.map((r) => {
                      const idx = results.indexOf(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelect(r)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                          style={{
                            background: cursor === idx ? "#f5f4fb" : "transparent",
                          }}
                          onMouseEnter={() => setCursor(idx)}
                        >
                          <div
                            className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                            style={{ background: "#f5f4fb" }}
                          >
                            {iconMap[r.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate" style={{ color: "#1a1040" }}>
                              {r.title}
                            </p>
                            {r.subtitle && (
                              <p className="text-[11px] truncate" style={{ color: "#9390b5" }}>
                                {r.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="px-4 py-2 text-[10px]" style={{ borderTop: "1px solid #f0eefb", color: "#b0aed0" }}>
                ↑↓ navigate · Enter to open · Esc to close
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Notification Bell ──────────────────────────────────────────────────────── */
function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { notifications, markAllNotificationsRead, clearNotifications, setActiveConversation } = useInboxStore();
  const unread = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      try {
        // Mark corresponding conversations read on the server
        const convIds = Array.from(new Set(notifications.map((n) => n.conversationId)));
        await Promise.all(
          convIds.map((id) => api.post(`/inbox/conversations/${id}/read`).catch(() => {}))
        );
      } catch (e) {
        // ignore
      }
      // Update local state
      markAllNotificationsRead();
    }
  };

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    setOpen(false);
    try {
      await api.post(`/inbox/conversations/${n.conversationId}/read`).catch(() => {});
    } catch (e) {
      // ignore
    }
    // Mark UI notifications as read
    markAllNotificationsRead();
    setActiveConversation(n.conversationId);
    router.push("/whatsapp/inbox");
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-full transition-colors"
        style={{ background: open ? "#ede9fe" : "#f5f4fb" }}
        aria-label="Notifications"
      >
        <Bell size={18} style={{ color: "#7c3aed" }} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full text-[9px] font-bold text-white px-1"
            style={{ background: "#f43f5e" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{
            background: "#fff",
            border: "1px solid #e8e6f5",
            width: "320px",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid #f0eefb" }}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" style={{ color: "#7c3aed" }} />
              <span className="font-semibold text-sm" style={{ color: "#1a1040" }}>
                Notifications
              </span>
              {notifications.length > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#f0eefb", color: "#7c3aed" }}
                >
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const convIds = Array.from(new Set(notifications.map((n) => n.conversationId)));
                        await Promise.all(convIds.map((id) => api.post(`/inbox/conversations/${id}/read`).catch(() => {})));
                      } catch (err) {}
                      markAllNotificationsRead();
                    }}
                    className="text-[11px] flex items-center gap-1 transition-colors"
                    style={{ color: "#7c3aed" }}
                    title="Mark all read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearNotifications(); }}
                    className="p-1 rounded-lg transition-colors"
                    style={{ color: "#b0aed0" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f4fb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    title="Clear all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="h-8 w-8" style={{ color: "#e0ddf5" }} />
                <p className="text-sm" style={{ color: "#b0aed0" }}>No notifications yet</p>
                <p className="text-[11px]" style={{ color: "#c0bed8" }}>
                  Incoming messages will appear here
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: "1px solid #f9f8ff" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Avatar */}
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
                  >
                    {(n.customerName?.[0] ?? "?").toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "#1a1040" }}>
                        {n.customerName}
                      </p>
                      <span className="text-[10px] shrink-0 whitespace-nowrap" style={{ color: "#b0aed0" }}>
                        {formatDistanceToNow(new Date(n.receivedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[12px] truncate mt-0.5" style={{ color: "#9390b5" }}>
                      {n.preview}
                    </p>
                    {n.customerPhone && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#c0bed8" }}>
                        {n.customerPhone}
                      </p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: "#7c3aed" }}
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-2.5"
              style={{ borderTop: "1px solid #f0eefb" }}
            >
              <button
                type="button"
                onClick={() => { setOpen(false); router.push("/whatsapp/inbox"); }}
                className="w-full text-center text-[12px] font-medium transition-colors"
                style={{ color: "#7c3aed" }}
              >
                Open Inbox →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────────────── */
export default function Navbar() {
  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e8e6f0",
        height: "60px",
        position: "relative",
        zIndex: 40,
      }}
    >
      <GlobalSearch />

      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* User */}
        <button
          className="flex items-center gap-2 rounded-full px-2 py-1.5"
          style={{ background: "#f5f4fb" }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
          >
            A
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[12px] font-semibold leading-tight" style={{ color: "#1a1040" }}>Admin</p>
            <p className="text-[10px]" style={{ color: "#9390b5" }}>Super Admin</p>
          </div>
          <ChevronDown size={12} style={{ color: "#9390b5" }} />
        </button>
      </div>
    </header>
  );
}
