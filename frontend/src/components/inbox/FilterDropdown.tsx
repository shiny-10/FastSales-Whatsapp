"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SlidersHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInboxStore } from "@/store/inbox-store";
import { cn } from "@/lib/utils";
import type { ConversationStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<{ value: ConversationStatus | null; label: string }> = [
  { value: null, label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const ARCHIVE_OPTIONS = [
  { value: false, label: "Active" },
  { value: true, label: "Archived" },
];

export function FilterDropdown() {
  const { statusFilter, setStatusFilter, archivedFilter, setArchivedFilter } = useInboxStore();

  const activeLabel = statusFilter ?? (archivedFilter === true ? "Archived" : "Active");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeLabel}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[140px] rounded-xl border bg-popover p-1 shadow-lg"
        >
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenu.Item
              key={s.label}
              onSelect={() => setStatusFilter(s.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-accent",
                statusFilter === s.value && "text-primary font-medium"
              )}
            >
              {statusFilter === s.value && <Check className="h-3.5 w-3.5" />}
              <span className={statusFilter !== s.value ? "ml-5" : ""}>{s.label}</span>
            </DropdownMenu.Item>
          ))}
          <div className="border-t border-border my-1" />
          {ARCHIVE_OPTIONS.map((option) => (
            <DropdownMenu.Item
              key={option.label}
              onSelect={() => setArchivedFilter(option.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-accent",
                archivedFilter === option.value && "text-primary font-medium"
              )}
            >
              {archivedFilter === option.value && <Check className="h-3.5 w-3.5" />}
              <span className={archivedFilter !== option.value ? "ml-5" : ""}>
                {option.label}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
