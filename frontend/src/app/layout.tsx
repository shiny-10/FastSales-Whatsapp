import "./globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />

          <div className="flex-1 flex flex-col">
            <Navbar />

            <main className="p-6 flex-1">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}