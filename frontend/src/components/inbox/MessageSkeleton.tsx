import { cn } from "@/lib/utils";

export function MessageSkeleton() {
  const rows: Array<{ agent: boolean; width: string }> = [
    { agent: false, width: "55%" },
    { agent: true,  width: "45%" },
    { agent: false, width: "70%" },
    { agent: true,  width: "35%" },
    { agent: false, width: "60%" },
    { agent: true,  width: "50%" },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn("flex", row.agent ? "justify-end" : "justify-start")}
        >
          <div
            className="h-9 rounded-2xl bg-muted animate-pulse"
            style={{ width: row.width }}
          />
        </div>
      ))}
    </div>
  );
}
