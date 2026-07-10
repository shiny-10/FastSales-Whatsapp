"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Users,
  FileText,
  Megaphone,
  MessageCircle,
  BarChart3,
} from "lucide-react";

const menus = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    title: "Templates",
    href: "/templates",
    icon: FileText,
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    title: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircle,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#064e3b] text-white h-screen flex flex-col">

      {/* Logo */}

      <div className="p-6 border-b border-green-700">

        <h1 className="text-3xl font-bold">

          FastSales CRM

        </h1>

        <p className="text-green-300 text-sm">

          WhatsApp Communication

        </p>

      </div>

      {/* Navigation */}

      <nav className="flex-1 p-3">

        {menus.map((menu) => {

          const Icon = menu.icon;

          const active = pathname === menu.href;

          return (

            <Link
              key={menu.title}
              href={menu.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all ${
                active
                  ? "bg-green-500"
                  : "hover:bg-green-700"
              }`}
            >

              <Icon size={20} />

              {menu.title}

            </Link>

          );

        })}

      </nav>

      {/* Footer */}

      <div className="m-4 bg-green-900 rounded-xl p-4">

        <p className="font-semibold">

          WhatsApp Business

        </p>

        <p className="text-green-300 text-sm">

          Connected

        </p>

        <button className="mt-4 bg-green-500 hover:bg-green-600 w-full rounded-lg py-2">

          View Settings

        </button>

      </div>

    </aside>
  );
}