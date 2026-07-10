"use client";

import Link from "next/link";

export default function ActivityPage() {
  const items = [
    { id: 1, text: 'Campaign "Order Update" completed', time: '2 minutes ago' },
    { id: 2, text: 'Message delivered to +91 9876543210', time: '5 minutes ago' },
    { id: 3, text: 'Template "order_confirmation_v2" approved', time: '15 minutes ago' },
    { id: 4, text: 'New contact added - Rahul Sharma', time: '30 minutes ago' },
  ];

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold">Activity</h1>
          <p className="text-gray-500 mt-2">Recent system and campaign activity</p>
        </div>
        <div>
          <Link href="/" className="text-green-600">Back to Dashboard</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
              <div>
                <p className="font-medium">{it.text}</p>
                <p className="text-xs text-gray-400">{it.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
