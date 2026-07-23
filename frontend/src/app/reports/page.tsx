"use client";
import { BarChart3, TrendingUp, MessageSquare, CheckCircle, Users, Zap, Download, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import {
  getDashboardSummary,
  getMessageAnalytics,
  getCampaigns,
  getTemplateOverview,
} from "../../services/dashboardService";
import { getTemplates } from "../../services/templateService";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };

export default function ReportsPage() {
  const [summary, setSummary] = useState({
    total_contacts: 0, total_templates: 0, total_campaigns: 0,
    total_messages: 0, sent: 0, delivered: 0, read: 0, failed: 0,
  });
  const [analytics, setAnalytics] = useState({
    delivery_rate: 0, read_rate: 0, failure_rate: 0,
  });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateOverview, setTemplateOverview] = useState({ approved: 0, pending: 0, rejected: 0, disabled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, a, c, t, to] = await Promise.all([
          getDashboardSummary(),
          getMessageAnalytics(),
          getCampaigns(),
          getTemplates(),
          getTemplateOverview(),
        ]);
        if (!alive) return;
        setSummary(s);
        setAnalytics(a);
        setCampaigns(Array.isArray(c) ? c : []);
        setTemplates(Array.isArray(t) ? t : []);
        setTemplateOverview(to);
      } catch { /* silent */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Compute top templates by most recently created (we have no "sent count" per template — use approved ones first)
  const topTemplates = templates
    .sort((a, b) => {
      // Approved first, then by created_at desc
      if (a.status === "APPROVED" && b.status !== "APPROVED") return -1;
      if (b.status === "APPROVED" && a.status !== "APPROVED") return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, 5);

  // Top campaigns by recipient count
  const topCampaigns = [...campaigns]
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, 5);

  const maxCampaignTotal = topCampaigns.reduce((max, c) => Math.max(max, c.total ?? 0), 1);

  const deliveryRate = Number(analytics?.delivery_rate) || 0;
  const readRate = Number(analytics?.read_rate) || 0;
  const failureRate = Number(analytics?.failure_rate) || 0;

  const metrics = [
    {
      label: "Delivery Rate",
      value: `${deliveryRate.toFixed(1)}%`,
      sub: "Messages delivered vs sent",
      color: "#10b981", bg: "rgba(16,185,129,0.10)", barColor: "#10b981",
      pct: deliveryRate, icon: CheckCircle,
    },
    {
      label: "Read Rate",
      value: `${readRate.toFixed(1)}%`,
      sub: "Messages read vs delivered",
      color: "#06b6d4", bg: "rgba(6,182,212,0.10)", barColor: "#06b6d4",
      pct: readRate, icon: MessageSquare,
    },
    {
      label: "Failure Rate",
      value: `${failureRate.toFixed(1)}%`,
      sub: "Messages failed to send",
      color: "#f43f5e", bg: "rgba(244,63,94,0.10)", barColor: "#f43f5e",
      pct: failureRate, icon: TrendingUp,
    },
    {
      label: "Total Reach",
      value: (summary?.total_contacts ?? 0).toLocaleString(),
      sub: "Total contacts in system",
      color: "#7c3aed", bg: "rgba(124,58,237,0.10)", barColor: "#7c3aed",
      pct: 100, icon: Users,
    },
  ];

  return (
    <div className="p-6 space-y-5 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>Analytics and performance overview</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
          <Zap size={14} /> Live Data
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl p-5" style={card}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#9390b5" }}>{m.label}</p>
                <div className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: m.bg }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
              </div>
              <p className="text-[28px] font-bold tabular-nums" style={{ color: "#1a1040" }}>
                {loading ? "—" : m.value}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9390b5" }}>{m.sub}</p>
              <div className="mt-3 h-1.5 rounded-full" style={{ background: "#f0eefb" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(m.pct, 100)}%`, background: m.barColor }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Campaign Performance */}
      <div className="grid xl:grid-cols-12 gap-5 items-stretch">

        {/* Message Volume bar chart */}
        <div className="xl:col-span-8 p-5 flex flex-col" style={card}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold text-[15px]" style={{ color: "#1a1040" }}>Message Volume</h3>
              <p className="text-xs mt-0.5" style={{ color: "#9390b5" }}>Breakdown by status</p>
            </div>
            <BarChart2 size={18} style={{ color: "#9390b5" }} />
          </div>

          {(() => {
            const barData = [
              { label: "Sent",      value: summary.sent,      fill: "#7c3aed" },
              { label: "Delivered", value: summary.delivered, fill: "#10b981" },
              { label: "Read",      value: summary.read,      fill: "#53bdeb" },
              { label: "Failed",    value: summary.failed,    fill: "#f43f5e" },
              { label: "Total",     value: summary.total_messages, fill: "#f59e0b" },
            ];

            const CustomTooltip = ({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div style={{ background:"#fff", border:"1px solid #ece9f8", borderRadius:"10px", padding:"8px 14px", boxShadow:"0 4px 16px rgba(100,80,200,0.12)", fontSize:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:payload[0].payload.fill, display:"inline-block" }} />
                    <span style={{ color:"#4b4880", fontWeight:600 }}>{payload[0].payload.label}</span>
                    <span style={{ fontWeight:700, color:"#1a1040", marginLeft:4 }}>{payload[0].value?.toLocaleString()}</span>
                  </div>
                </div>
              );
            };

            return (
              <div style={{ height: 260, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ left: 0, right: 20, top: 8, bottom: 8 }}
                  >
                    <YAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 13, fill: "#4b4880", fontWeight: 500 }}
                      width={70}
                    />
                    <XAxis dataKey="value" type="number" hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(124,58,237,0.05)" }} />
                    <Bar dataKey="value" radius={5} maxBarSize={28}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "#9390b5" }}>
            <TrendingUp size={13} style={{ color: "#10b981" }} />
            <span>Showing message delivery breakdown for all time</span>
          </div>
        </div>

        {/* Campaign Performance — replaces Top Templates */}
        <div className="xl:col-span-4 p-5 flex flex-col" style={card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[15px]" style={{ color: "#1a1040" }}>Campaign Performance</h3>
              <p className="text-xs mt-0.5" style={{ color: "#9390b5" }}>Top campaigns by recipients</p>
            </div>
            <span className="text-[11px] font-medium" style={{ color: "#9390b5" }}>{campaigns.length} total</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg skeleton" />)}
            </div>
          ) : topCampaigns.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#b0aed0" }}>No campaigns yet</p>
          ) : (
            <div className="space-y-4">
              {topCampaigns.map((c, i) => {
                const pct = maxCampaignTotal > 0 ? ((c.total ?? 0) / maxCampaignTotal) * 100 : 0;
                const deliveryPct = (c.total ?? 0) > 0 ? Math.round(((c.delivered ?? 0) / c.total) * 100) : 0;
                const statusColor = c.status === "completed" ? "#10b981" : c.status === "running" ? "#f59e0b" : "#7c3aed";
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold w-4 flex-shrink-0" style={{ color: "#b0aed0" }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate" style={{ color: "#1a1040" }}>{c.name ?? c.campaign_name ?? "—"}</p>
                        <span className="text-[10px] font-semibold ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ background: `${statusColor}15`, color: statusColor }}>
                          {c.status ?? "scheduled"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#f0eefb" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }} />
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: "#10b981" }}>
                        {(c.total ?? 0)} msgs · {deliveryPct}% delivered
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Messages", value: summary.total_messages, color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
          { label: "Delivered",      value: summary.delivered,      color: "#10b981", bg: "rgba(16,185,129,0.08)"  },
          { label: "Read",           value: summary.read,           color: "#06b6d4", bg: "rgba(6,182,212,0.08)"   },
          { label: "Failed",         value: summary.failed,         color: "#f43f5e", bg: "rgba(244,63,94,0.08)"   },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl p-5 flex items-center justify-between" style={{ ...card, minHeight: "110px" }}>
            <div>
              <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#9390b5" }}>{label}</p>
              <p className="text-[26px] font-bold tabular-nums" style={{ color }}>
                {loading ? "—" : value.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: bg }} />
          </div>
        ))}
      </div>

    </div>
  );
}
