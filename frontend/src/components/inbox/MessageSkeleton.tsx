export function MessageSkeleton() {
  const rows: Array<{ agent: boolean; width: string }> = [
    { agent: false, width: "52%" },
    { agent: true,  width: "44%" },
    { agent: false, width: "68%" },
    { agent: true,  width: "38%" },
    { agent: false, width: "58%" },
    { agent: true,  width: "48%" },
  ];

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      {rows.map((row, i) => (
        <div key={i} className={`flex ${row.agent ? "justify-end" : "justify-start"}`}>
          <div
            className="h-9 rounded-2xl"
            style={{
              width: row.width,
              background: row.agent ? "#f0eeff" : "#f0f1f5",
              animation: "pulse 1.6s ease infinite",
            }}
          />
        </div>
      ))}
    </div>
  );
}
