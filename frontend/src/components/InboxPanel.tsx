"use client";

import {
  CheckCircle2,
  MessageCircle,
  UserPlus,
  Clock,
  ArrowRight,
} from "lucide-react";

interface Activity {
  id: number;
  title: string;
  description: string;
  time: string;
  type: "message" | "campaign" | "contact" | "template";
}

interface InboxPanelProps {
  activities: Activity[];
}

export default function InboxPanel({
  activities,
}: InboxPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">

      {/* Header */}

      <div className="flex justify-between items-center mb-5">

        <h2 className="text-xl font-bold">

          Recent Activity

        </h2>

        <button className="text-green-600 hover:underline text-sm font-semibold">

          View All

        </button>

      </div>

      {/* Activity List */}

      <div className="space-y-5">

        {activities.map((item) => (

          <div
            key={item.id}
            className="flex items-start gap-4"
          >

            <div className="h-11 w-11 rounded-full bg-green-100 flex items-center justify-center">

              {item.type === "campaign" && (
                <CheckCircle2
                  className="text-green-600"
                  size={20}
                />
              )}

              {item.type === "message" && (
                <MessageCircle
                  className="text-blue-600"
                  size={20}
                />
              )}

              {item.type === "contact" && (
                <UserPlus
                  className="text-purple-600"
                  size={20}
                />
              )}

              {item.type === "template" && (
                <Clock
                  className="text-orange-500"
                  size={20}
                />
              )}

            </div>

            <div className="flex-1">

              <h4 className="font-semibold text-gray-800">

                {item.title}

              </h4>

              <p className="text-sm text-gray-500 mt-1">

                {item.description}

              </p>

            </div>

            <div className="text-xs text-gray-400">

              {item.time}

            </div>

          </div>

        ))}

      </div>

      {/* Footer */}

      <div className="mt-6">

        <button className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white flex justify-center items-center gap-2 transition">

          Open Shared Inbox

          <ArrowRight size={18} />

        </button>

      </div>

    </div>
  );
}