import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(dateStr: string): string {
  // Ensure the string is treated as UTC — add Z if no timezone info present
  const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const date = new Date(utcStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return format(date, "h:mm a");
  return format(date, "dd/MM/yyyy");
}

export function formatDateSeparator(dateStr: string): string {
  const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const date = new Date(utcStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function isSameDay(a: string, b: string): boolean {
  const toUtc = (s: string) => s.endsWith("Z") || s.includes("+") ? s : s + "Z";
  return format(new Date(toUtc(a)), "yyyy-MM-dd") === format(new Date(toUtc(b)), "yyyy-MM-dd");
}

export function formatLastSeen(dateStr?: string | null): string {
  if (!dateStr) return "last seen recently";
  try {
    const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(utcStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    // Within last minute
    if (diffMins < 1) return "online";
    // Within last hour — show "X minutes ago"
    if (diffMins < 60) return `last seen ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    // Today — show "last seen today at H:MM AM/PM"
    if (isToday(date)) return `last seen today at ${format(date, "h:mm a")}`;
    // Yesterday
    if (isYesterday(date)) return `last seen yesterday at ${format(date, "h:mm a")}`;
    // Older
    return `last seen ${format(date, "dd/MM/yyyy")} at ${format(date, "h:mm a")}`;
  } catch {
    return "last seen recently";
  }
}

export function getInitials(name?: string, phone?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return phone?.slice(-2) ?? "??";
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

export function statusColor(status: string): string {
  switch (status) {
    case "OPEN": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "RESOLVED": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "CLOSED": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    default: return "bg-gray-100 text-gray-600";
  }
}
