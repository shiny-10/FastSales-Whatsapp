"use client";

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="bg-white/80 dark:bg-gray-800/80 text-xs text-gray-500 dark:text-gray-400 font-medium px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}
