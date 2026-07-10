export function ConversationSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl px-3 py-3"
        >
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
          {/* Lines */}
          <div className="flex-1 space-y-2 pt-1">
            <div
              className="h-3 rounded-full bg-muted animate-pulse"
              style={{ width: `${55 + (i % 4) * 10}%` }}
            />
            <div
              className="h-2.5 rounded-full bg-muted animate-pulse"
              style={{ width: `${40 + (i % 3) * 12}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
