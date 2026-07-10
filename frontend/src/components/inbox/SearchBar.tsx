"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useInboxStore } from "@/store/inbox-store";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useInboxStore();

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search conversations…"
        className="pl-9 pr-8"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setSearchQuery("")}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
