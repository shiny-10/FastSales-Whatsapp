export function ConversationSkeleton() {
  return (
    <div className="space-y-0 py-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          {/* Avatar */}
          <div
            className="h-11 w-11 rounded-full flex-shrink-0"
            style={{ background: "#f0f1f5", animation: "pulse 1.6s ease infinite" }}
          />
          {/* Lines */}
          <div className="flex-1 space-y-2">
            <div
              className="h-3 rounded-full"
              style={{ width: `${52 + (i % 4) * 11}%`, background: "#f0f1f5", animation: "pulse 1.6s ease infinite" }}
            />
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${35 + (i % 3) * 13}%`, background: "#f5f6fa", animation: "pulse 1.6s ease infinite" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
