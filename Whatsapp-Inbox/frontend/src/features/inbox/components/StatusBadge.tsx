import { cn, statusColor } from "@/shared/lib/utils";
import type { ConversationStatus } from "@/shared/types";

interface StatusBadgeProps {
  status: ConversationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        statusColor(status),
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-green-500": status === "OPEN",
          "bg-yellow-500": status === "PENDING",
          "bg-blue-500": status === "RESOLVED",
          "bg-gray-400": status === "CLOSED",
        })}
      />
      {status}
    </span>
  );
}
