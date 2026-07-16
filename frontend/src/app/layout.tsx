"use client";

import "./globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { Providers } from "../components/providers";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isInbox =
    pathname === "/whatsapp" ||
    pathname.startsWith("/whatsapp/inbox");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main
          className={isInbox ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-6"}
          style={isInbox ? {} : { background: "var(--c-bg)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-background">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}