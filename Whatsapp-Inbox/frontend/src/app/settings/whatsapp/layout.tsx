"use client";
import { AppShell } from "@/components/layout/AppShell";

export default function WhatsAppSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="min-h-screen overflow-y-auto bg-gray-50 dark:bg-gray-950">
        {children}
      </div>
    </AppShell>
  );
}
