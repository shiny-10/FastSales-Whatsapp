"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

interface Campaign {
  id: number;
  name?: string;
  campaign_name?: string;
  status?: string;
  recipients?: number;
  contact_count?: number;
  messagesSent?: number;
  createdAt?: string;
  created_at?: string;
}

interface CampaignsTableProps {
  campaigns: Campaign[];
}

export default function CampaignsTable({ campaigns }: CampaignsTableProps) {
  if (!campaigns.length) {
    return (
      <div className="px-5 py-10 text-center text-sm" style={{ color: "#9390b5" }}>
        No campaigns yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Status</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th>Created</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="font-medium" style={{ color: "#1a1040" }}>
                  {c.name ?? c.campaign_name ?? "—"}
                </span>
              </td>
              <td>
                <StatusBadge status={(c.status ?? "scheduled") as any} />
              </td>
              <td>{(c.recipients ?? c.contact_count ?? 0).toLocaleString()}</td>
              <td>{(c.messagesSent ?? 0).toLocaleString()}</td>
              <td>
                {c.createdAt ?? (c.created_at ? new Date(c.created_at).toLocaleDateString() : "—")}
              </td>
              <td>
                <div className="flex items-center justify-center gap-2">
                  {[
                    { Icon: Eye,    color: "#7c3aed", hover: "rgba(124,58,237,0.10)" },
                    { Icon: Pencil, color: "#06b6d4", hover: "rgba(6,182,212,0.10)"  },
                    { Icon: Trash2, color: "#f43f5e", hover: "rgba(244,63,94,0.10)"  },
                  ].map(({ Icon, color, hover }, i) => (
                    <button
                      key={i}
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                      style={{ background: "rgba(100,80,200,0.05)", border: "1px solid rgba(100,80,200,0.10)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(100,80,200,0.05)")}
                    >
                      <Icon size={13} style={{ color }} />
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: "completed" | "running" | "scheduled" }) {
  const map = {
    completed: { label: "Completed", bg: "rgba(16,185,129,0.15)", color: "#10b981" },
    running:   { label: "Running",   bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    scheduled: { label: "Scheduled", bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  };
  const s = map[status] ?? map.scheduled;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
