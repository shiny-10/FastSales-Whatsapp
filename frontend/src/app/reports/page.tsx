"use client";
import { BarChart3, TrendingUp, MessageSquare, CheckCircle, Users, Zap } from "lucide-react";
import Messagecharts from "../../components/charts/messagecharts";
import { useState, useEffect } from "react";
import { getDashboardSummary } from "../../services/dashboardService";

const glass = { background: "linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.08)" };

export default function ReportsPage() {
  const [summary, setSummary] = useState({ total_contacts: 0, total_templates: 0, total_campaigns: 0, total_messages: 0, sent: 0, delivered: 0, read: 0, failed: 0 });
  useEffect(() => { getDashboardSummary().then(setSummary).catch(() => {}); }, []);

  const deliveryRate = summary.total_messages > 0 ? ((summary.delivered / summary.total_messages) * 100).toFixed(1) : "0.0";
  const readRate = summary.delivered > 0 ? ((summary.read / summary.delivered) * 100).toFixed(1) : "0.0";
  const failRate = summary.total_messages > 0 ? ((summary.failed / summary.total_messages) * 100).toFixed(1) : "0.0";

  const metrics = [
    { label: "Delivery Rate", value: `${deliveryRate}%`, sub: "Messages delivered vs sent", color: "#10b981", icon: CheckCircle, pct: parseFloat(deliveryRate) },
    { label: "Read Rate", value: `${readRate}%`, sub: "Messages read vs delivered", color: "#06b6d4", icon: MessageSquare, pct: parseFloat(readRate) },
    { label: "Failure Rate", value: `${failRate}%`, sub: "Messages failed to send", color: "#f43f5e", icon: TrendingUp, pct: parseFloat(failRate) },
    { label: "Total Reach", value: summary.total_contacts.toLocaleString(), sub: "Total contacts in system", color: "#7c3aed", icon: Users, pct: 100 },
  ];

  const topTemplates = [
    { name: "order_confirmation", sent: 1240, rate: "94.2%" },
    { name: "delivery_update", sent: 980, rate: "91.5%" },
    { name: "payment_reminder", sent: 750, rate: "88.7%" },
    { name: "welcome_message", sent: 620, rate: "96.1%" },
    { name: "feedback_request", sent: 430, rate: "82.3%" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Reports</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Analytics and performance overview</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
          <Zap size={14} /> Live Data
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl p-5 hover-lift" style={{ ...glass, position: "relative", overflow: "hidden" }}>
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-15 blur-xl pointer-events-none" style={{ background: m.color }} />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>{m.label}</p>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: m.color + "22" }}>
                    <Icon size={15} style={{ color: m.color }} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums">{m.value}</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{m.sub}</p>
                <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(m.pct, 100)}%`, background: m.color, transition: "width 1s ease" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Top templates */}
      <div className="grid xl:grid-cols-12 gap-5">
        {/* Message chart */}
        <div className="xl:col-span-8 rounded-2xl p-5" style={glass}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-white">Message Volume</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Monthly breakdown</p>
            </div>
            <BarChart3 size={18} style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
          <div className="h-64">
            <Messagecharts summary={summary} />
          </div>
        </div>

        {/* Top templates */}
        <div className="xl:col-span-4 rounded-2xl p-5" style={glass}>
          <h3 className="font-semibold text-white mb-4">Top Templates</h3>
          <div className="space-y-3">
            {topTemplates.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-xs font-bold w-4" style={{ color: "rgba(255,255,255,0.3)" }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{t.name}</p>
                  <div className="mt-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: t.rate, background: "linear-gradient(90deg,#7c3aed,#4f46e5)" }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold" style={{ color: "#10b981" }}>{t.rate}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{t.sent}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Messages", value: summary.total_messages, color: "#7c3aed" },
          { label: "Delivered", value: summary.delivered, color: "#10b981" },
          { label: "Read", value: summary.read, color: "#06b6d4" },
          { label: "Failed", value: summary.failed, color: "#f43f5e" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-5" style={glass}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
