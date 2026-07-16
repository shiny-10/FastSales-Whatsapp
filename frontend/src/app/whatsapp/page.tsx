"use client";
import InboxPage from "./inbox/page";

export default function WhatsAppPage() {
  // layout.tsx gives this page a flex-1 overflow-hidden main, so InboxPage
  // just needs to fill its parent completely.
  return (
    <div className="h-full w-full overflow-hidden">
      <InboxPage />
    </div>
  );
}
