"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Messagecharts from "../components/charts/messagecharts";
import StatsCard from "../components/StatsCard";
import TemplateDonutChart from "../components/charts/TemplateDonutChart";
import CampaignsTable from "../components/CampaignsTable";
import {
  getDashboardSummary,
  getDashboardOverview,
  getCampaigns,
  getTemplateOverview,
} from "../services/dashboardService";
import {
  Users, MessageSquare, FileText, Megaphone,
  ArrowRight, Activity, CheckCircle2, Send,
  Plus, Zap,
} from "lucide-react";

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
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templateOverview, setTemplateOverview] = useState({
    approved: 0, pending: 0, rejected: 0, disabled: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, , c, t] = await Promise.all([
          getDashboardSummary(),
          getDashboardOverview(),
          getCampaigns(),
          getTemplateOverview(),
        ]);
        if (!alive) return;
        setSummary(d);
        setCampaigns(Array.isArray(c) ? c : []);
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
      icon: <Users size={20} />,
      gradient: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      glowClass: "ring-violet",
      trend: "up" as const,
    },
    {
      title: "Messages Sent",
      value: summary.total_messages,
      change: "+18.6% this month",
      icon: <MessageSquare size={20} />,
      gradient: "linear-gradient(135deg,#06b6d4,#0284c7)",
      glowClass: "ring-cyan",
      trend: "up" as const,
    },
    {
      title: "Active Templates",
      value: summary.total_templates,
      change: "+8.3% this month",
      icon: <FileText size={20} />,
      gradient: "linear-gradient(135deg,#10b981,#059669)",
      glowClass: "ring-emerald",
      trend: "up" as const,
    },
    {
      title: "Campaigns",
      value: summary.total_campaigns,
      change: "+14.7% this month",
      icon: <Megaphone size={20} />,
      gradient: "linear-gradient(135deg,#f43f5e,#e11d48)",
      glowClass: "ring-rose",
      trend: "up" as const,
    },
  ];

  const quickActions = [
    { label: "New Contact",   href: "/contacts",  icon: Users,        color: "#7c3aed" },
    { label: "New Template",  href: "/templates", icon: FileText,     color: "#06b6d4" },
    { label: "New Campaign",  href: "/campaigns", icon: Megaphone,    color: "#10b981" },
    { label: "Open Inbox",    href: "/whatsapp",  icon: MessageSquare,color: "#25d366" },
  ];

  const activity = [
    { icon: "✅", label: 'Campaign "Order Update" completed',       time: "2m ago",  color: "#10b981" },
    { icon: "💬", label: "Message delivered to +91 98765 43210",   time: "5m ago",  color: "#06b6d4" },
    { icon: "📝", label: 'Template "order_confirm_v2" approved',    time: "15m ago", color: "#a78bfa" },
    { icon: "➕", label: "New contact added — Rahul Sharma",        time: "30m ago", color: "#f59e0b" },
    { icon: "📊", label: "Weekly report generated",                 time: "1h ago",  color: "#f43f5e" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Good morning, Admin 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Here's what's happening with your WhatsApp CRM today.
          </p>
        </div>

        <Link
          href="/whatsapp"
          className="btn-glow flex items-center gap-2 text-sm"
        >
          <Zap size={15} />
          Open Inbox
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} />
        ))}
      </div>

      {/* ── Main content: chart + side panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Chart + table */}
        <div className="xl:col-span-8 space-y-5">

          {/* Message performance chart */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-[15px] text-white">Message Performance</h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>This month</p>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-violet-400" />Sent</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />Delivered</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Read</span>
              </div>
            </div>
            <div className="h-64">
              <Messagecharts summary={summary} />
            </div>
          </div>

          {/* Delivery metrics strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Delivered", value: summary.delivered, icon: <CheckCircle2 size={16} />, color: "#10b981", pct: summary.total_messages ? Math.round((summary.delivered / summary.total_messages) * 100) : 0 },
              { label: "Read",      value: summary.read,      icon: <Activity      size={16} />, color: "#06b6d4", pct: summary.total_messages ? Math.round((summary.read      / summary.total_messages) * 100) : 0 },
              { label: "Failed",    value: summary.failed,    icon: <Send          size={16} />, color: "#f43f5e", pct: summary.total_messages ? Math.round((summary.failed    / summary.total_messages) * 100) : 0 },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl p-4"
                style={{
                  background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">{m.value.toLocaleString()}</p>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${m.pct}%`, background: m.color }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{m.pct}% of total</p>
              </div>
            ))}
          </div>

          {/* Recent campaigns */}
          <div
            className="rounded-2xl"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <h3 className="font-semibold text-[15px] text-white">Recent Campaigns</h3>
              <Link
                href="/campaigns"
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "rgba(124,58,237,0.9)" }}
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <CampaignsTable campaigns={campaigns.slice(0, 5)} />
          </div>
        </div>

        {/* Right column */}
        <div className="xl:col-span-4 space-y-5">

          {/* Template overview */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h3 className="font-semibold text-[15px] text-white mb-4">Template Overview</h3>
            <TemplateDonutChart data={templateOverview} />
          </div>

          {/* Quick actions */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h3 className="font-semibold text-[15px] text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all hover:scale-105"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-xl"
                      style={{ background: `${a.color}22` }}
                    >
                      <Icon size={18} style={{ color: a.color }} />
                    </div>
                    <span className="text-[12px] font-medium text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {a.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[15px] text-white">Recent Activity</h3>
              <Link href="/activity" className="text-xs font-medium" style={{ color: "rgba(124,58,237,0.9)" }}>
                See all
              </Link>
            </div>
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full text-sm flex-shrink-0 mt-0.5"
                    style={{ background: `${a.color}20` }}
                  >
                    {a.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>
                      {a.label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
