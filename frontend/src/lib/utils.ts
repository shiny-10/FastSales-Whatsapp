import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `Yesterday ${format(date, "HH:mm")}`;
  return format(date, "dd/MM/yyyy HH:mm");
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function isSameDay(a: string, b: string): boolean {
  return format(new Date(a), "yyyy-MM-dd") === format(new Date(b), "yyyy-MM-dd");
}

export function formatLastSeen(dateStr?: string): string {
  if (!dateStr) return "Never";
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
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
