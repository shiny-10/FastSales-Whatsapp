"use client";

import {
  Search,
  Bell,
} from "lucide-react";

export default function Navbar() {
  return (
    <header className="bg-white h-20 shadow-sm flex items-center justify-between px-8">

      {/* Search */}

      <div className="relative w-[420px]">

        <Search
          size={18}
          className="absolute left-4 top-3 text-gray-400"
        />

        <input
          type="text"
          placeholder="Search anything..."
          className="w-full pl-11 pr-4 py-3 rounded-full border focus:outline-none"
        />

      </div>

      {/* Right */}

      <div className="flex items-center gap-6">

        <button className="relative">

          <Bell size={22} />

          <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">

            3

          </span>

        </button>

        <div className="flex items-center gap-3 bg-white shadow rounded-xl px-4 py-2">

          <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">

            A

          </div>

          <div>

            <h4 className="font-semibold">

              Admin

            </h4>

            <p className="text-xs text-gray-500">

              Super Admin

            </p>

          </div>

        </div>

      </div>

    </header>
  );
}