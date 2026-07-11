"use client";

import Link from "next/link";

export default function SearchPage({ searchParams }: { searchParams: any }) {
  const q = (searchParams && searchParams.q) || "";

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold">Search</h1>
          <p className="text-gray-500 mt-2">Results for {"\""}{q}{"\""}</p>
        </div>
        <div>
          <Link href="/" className="text-green-600">Back to Dashboard</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        {q ? (
          <div>
            <p className="text-gray-700">No results found for <strong>{"\""}{q}{"\""}</strong>.</p>
            <p className="text-sm text-gray-400 mt-2">(Implement backend search to show real results.)</p>
          </div>
        ) : (
          <p className="text-gray-500">Please enter a search query.</p>
        )}
      </div>
    </div>
  );
}
