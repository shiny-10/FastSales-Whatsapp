"use client";

import {
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

interface Campaign {
  id: number;
  name: string;
  status: "completed" | "running" | "scheduled";
  recipients: number;
  messagesSent: number;
  createdAt: string;
}

interface CampaignsTableProps {
  campaigns: Campaign[];
}

export default function CampaignsTable({
  campaigns,
}: CampaignsTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">

      <div className="flex items-center justify-between mb-6">

        <h2 className="text-xl font-bold">
          Recent Campaigns
        </h2>

        <button className="text-green-600 font-semibold hover:underline">
          View All
        </button>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead>

            <tr className="border-b text-gray-500 text-sm">

              <th className="text-left py-4">
                Campaign Name
              </th>

              <th className="text-left">
                Status
              </th>

              <th className="text-left">
                Recipients
              </th>

              <th className="text-left">
                Messages Sent
              </th>

              <th className="text-left">
                Created
              </th>

              <th className="text-center">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {campaigns.map((campaign) => (

              <tr
                key={campaign.id}
                className="border-b hover:bg-gray-50 transition"
              >

                <td className="py-5 font-medium">

                  {campaign.name}

                </td>

                <td>

                  <StatusBadge
                    status={campaign.status}
                  />

                </td>

                <td>

                  {campaign.recipients}

                </td>

                <td>

                  {campaign.messagesSent}

                </td>

                <td>

                  {campaign.createdAt}

                </td>

                <td>

                  <div className="flex justify-center gap-3">

                    <button className="h-9 w-9 rounded-full bg-gray-100 hover:bg-green-100 flex items-center justify-center">

                      <Eye
                        size={17}
                        className="text-gray-700"
                      />

                    </button>

                    <button className="h-9 w-9 rounded-full bg-gray-100 hover:bg-blue-100 flex items-center justify-center">

                      <Pencil
                        size={17}
                        className="text-blue-600"
                      />

                    </button>

                    <button className="h-9 w-9 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center">

                      <Trash2
                        size={17}
                        className="text-red-600"
                      />

                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}

interface StatusProps {
  status: "completed" | "running" | "scheduled";
}

function StatusBadge({
  status,
}: StatusProps) {
  if (status === "completed") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Completed
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        Running
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
      Scheduled
    </span>
  );
}