"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Messagecharts from "../components/charts/messagecharts";
import StatsCard from "../components/StatsCard";
import TemplateDonutChart from "../components/charts/TemplateDonutChart";
import {
  getDashboardSummary,
  getDashboardOverview,
  getCampaigns,
  getTemplateOverview,
} from "../services/dashboardService";
import {
  Users, MessageSquare, FileText, Megaphone, Send,
  CheckCircle2, Eye, XCircle, Clock,
} from "lucide-react";

const card = {
  background: "#ffffff",
  border: "1px solid #ece9f8",
  borderRadius: "16px",
  boxShadow: "0 1px 6px rgba(100,80,200,0.07)",
};

export default function Home() {
  const [summary, setSummary] = useState({
    total_contacts: 0,
    total_templates: 0,
    total_campaigns: 0,
    total_messages: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });
  const [templateOverview, setTemplateOverview] = useState({
    approved: 0, pending: 0, rejected: 0, disabled: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, , , t] = await Promise.all([
          getDashboardSummary(),
          getDashboardOverview(),
          getCampaigns(),
          getTemplateOverview(),
        ]);
        if (!alive) return;
        setSummary(d);
        setTemplateOverview(t);
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, []);

  const stats = [
    {
      title: "Total Contacts",
      value: summary.total_contacts,
      change: "+12.5% this month",
      icon: <Users size={22} />,
      gradient: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      glowClass: "ring-violet",
      trend: "up" as const,
    },
    {
      title: "Messages Sent",
      value: summary.total_messages,
      change: "+18.6% this month",
      icon: <Send size={22} />,
      gradient: "linear-gradient(135deg,#06b6d4,#0284c7)",
      glowClass: "ring-cyan",
      trend: "up" as const,
    },
    {
      title: "Active Templates",
      value: summary.total_templates,
      change: "+8.3% this month",
      icon: <FileText size={22} />,
      gradient: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      glowClass: "ring-violet",
      trend: "up" as const,
    },
    {
      title: "Campaigns",
      value: summary.total_campaigns,
      change: "+14.7% this month",
      icon: <Megaphone size={22} />,
      gradient: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      glowClass: "ring-violet",
      trend: "up" as const,
    },
  ];

  // Bottom 4 metric cards — exactly matching the image
  const metrics = [
    {
      label: "Delivered",
      value: summary.delivered,
      icon: <CheckCircle2 size={22} />,
      iconColor: "#10b981",
      iconBg: "rgba(16,185,129,0.12)",
      iconBorder: "rgba(16,185,129,0.35)",
      cardBg: "#f0faf5",
    },
    {
      label: "Read",
      value: summary.read,
      icon: <Eye size={22} />,
      iconColor: "#7c3aed",
      iconBg: "rgba(124,58,237,0.10)",
      iconBorder: "rgba(124,58,237,0.30)",
      cardBg: "#f5f3ff",
    },
    {
      label: "Failed",
      value: summary.failed,
      icon: <XCircle size={22} />,
      iconColor: "#f43f5e",
      iconBg: "rgba(244,63,94,0.10)",
      iconBorder: "rgba(244,63,94,0.30)",
      cardBg: "#fff5f7",
    },
    {
      label: "Pending",
      value: summary.sent,
      icon: <Clock size={22} />,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.10)",
      iconBorder: "rgba(245,158,11,0.30)",
      cardBg: "#fffbf0",
    },
  ];

  return (
    <div className="min-h-screen space-y-5 animate-fade-up" style={{ padding: "24px" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>
            {(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}, Admin
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>
            Here's what's happening with your WhatsApp CRM today.
          </p>
        </div>
        <Link
          href="/whatsapp"
          className="flex items-center gap-2 text-sm font-semibold rounded-xl px-5 py-2.5 text-white"
          style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
        >
          <Send size={14} />
          Open Inbox
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} />
        ))}
      </div>

      {/* ── Chart row: Message Performance + Template Overview ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">

        {/* Message Performance chart */}
        <div className="xl:col-span-7" style={card}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-semibold text-[15px]" style={{ color: "#1a1040" }}>Message Performance</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9390b5" }}>Last 6 months</p>
          </div>
          <div className="px-4 pb-4" style={{ height: 300 }}>
            <Messagecharts summary={{ ...summary, total_campaigns: summary.total_campaigns }} />
          </div>
        </div>

        {/* Template Overview donut */}
        <div className="xl:col-span-5" style={{ ...card, padding: "20px", minHeight: "360px" }}>
          <h2 className="font-semibold text-[15px] mb-4" style={{ color: "#1a1040" }}>Template Overview</h2>
          <TemplateDonutChart data={templateOverview} />
        </div>
      </div>

      {/* ── Bottom metrics row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: m.cardBg,
              border: `1px solid ${m.iconBorder}`,
              boxShadow: "0 1px 4px rgba(100,80,200,0.06)",
            }}
          >
            {/* Circle icon */}
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 48, height: 48,
                background: "#ffffff",
                border: `2px solid ${m.iconBorder}`,
                color: m.iconColor,
              }}
            >
              {m.icon}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "#9390b5" }}>{m.label}</p>
              <p className="text-[26px] font-bold leading-none tabular-nums mt-0.5" style={{ color: "#1a1040" }}>
                {m.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
