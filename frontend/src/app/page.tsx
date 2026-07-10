"use client";
import Messagecharts from "../components/charts/messagecharts";
import { useState, useEffect } from "react";
import StatsCard from "../components/StatsCard";
import {
  getDashboardSummary,
  getDashboardOverview,
  getCampaigns,
  getTemplateOverview,
} from "../services/dashboardService";
import { FaUsers, FaWhatsapp, FaFileAlt, FaBullhorn } from "react-icons/fa";
import { FaBell, FaSearch } from "react-icons/fa";
import { useRouter } from "next/navigation";

import TemplateDonutChart from "../components/charts/TemplateDonutChart";
import Link from "next/link";
import CampaignsTable from "../components/CampaignsTable";



export default function Home() {
  const router = useRouter();
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
  const [overview, setOverview] = useState({
    total_campaigns: 0,
    total_messages: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });

  const [campaigns, setCampaigns] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [notificationCount, setNotificationCount] = useState(3);

  const [templateOverview, setTemplateOverview] = useState({
  approved: 0,
  pending: 0,
  rejected: 0,
  disabled: 0,
});

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [dashboardData, overviewData, campaignsData, templateData] = await Promise.all([
          getDashboardSummary(),
          getDashboardOverview(),
          getCampaigns(),
          getTemplateOverview(),
        ]);

        if (!isMounted) {
          return;
        }

        setSummary(dashboardData);
        setOverview(overviewData);
        setCampaigns(campaignsData);
        setTemplateOverview(templateData);
      } catch (error) {
        console.error(error);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, []);
  
  return (
    <div className="bg-slate-100 min-h-screen p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Dashboard 👋</h1>
          <p className="text-gray-500 mt-1">Welcome back, Admin! Here&apos;s what&apos;s happening with your WhatsApp CRM.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`); } }}
              type="text"
              placeholder="Search anything..."
              className="border rounded-full px-4 py-2 pr-10 w-72 bg-white"
            />

            <button
              onClick={() => { if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#25D366] text-white w-8 h-8 rounded-full flex items-center justify-center"
              aria-label="Search"
            >
              <FaSearch />
            </button>
          </div>

          <div className="relative">
            <button className="bg-white shadow rounded-lg px-3 py-2 flex items-center justify-center">
              <FaBell className="text-lg text-gray-600" />
            </button>

            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 bg-white shadow rounded-lg px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold">A</div>
            <div>
              <p className="font-semibold">Admin</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-6">
        <StatsCard title="Total Contacts" value={summary.total_contacts} icon={<FaUsers />} growth="12.5% from last month" />
        <StatsCard title="Total Templates" value={summary.total_templates} icon={<FaFileAlt />} growth="8.3% from last month" />
        <StatsCard title="Total Campaigns" value={summary.total_campaigns} icon={<FaBullhorn />} growth="14.7% from last month" />
        <StatsCard title="Messages Sent" value={summary.total_messages} icon={<FaWhatsapp />} growth="18.6% from last month" />
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-8 bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Message Performance (This Month)</h2>
          <div className="h-96">
            <Messagecharts summary={summary} />
          </div>

          {/* Recent Campaigns moved here (replaces small stats row) */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Recent Campaigns</h3>
            <CampaignsTable campaigns={campaigns.slice(0, 5)} />
          </div>
        </div>

        <div className="col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Template Overview</h2>
            <TemplateDonutChart data={templateOverview} />
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                <div>
                  <p className="text-sm">Campaign {"\"Order Update\""} completed</p>
                  <p className="text-xs text-gray-400">2 minutes ago</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">💬</div>
                <div>
                  <p className="text-sm">Message delivered to +91 9876543210</p>
                  <p className="text-xs text-gray-400">5 minutes ago</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">📝</div>
                <div>
                  <p className="text-sm">Template {"\"order_confirmation_v2\""} approved</p>
                  <p className="text-xs text-gray-400">15 minutes ago</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">➕</div>
                <div>
                  <p className="text-sm">New contact added - Rahul Sharma</p>
                  <p className="text-xs text-gray-400">30 minutes ago</p>
                </div>
              </li>
            </ul>

            <div className="mt-4 text-center">
              <Link href="/activity" className="text-sm text-green-600 font-medium">View All Activity</Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-4">
              <Link href="/contacts" className="flex flex-col items-center gap-2 py-3 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <FaUsers className="text-2xl text-green-600" />
                </div>
                <span className="text-sm">Add Contact</span>
              </Link>

              <Link href="/templates" className="flex flex-col items-center gap-2 py-3 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <FaFileAlt className="text-2xl text-green-600" />
                </div>
                <span className="text-sm">Create Template</span>
              </Link>

              <Link href="/campaigns" className="flex flex-col items-center gap-2 py-3 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <FaBullhorn className="text-2xl text-green-600" />
                </div>
                <span className="text-sm">Create Campaign</span>
              </Link>

              <Link href="/whatsapp" className="flex flex-col items-center gap-2 py-3 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <FaWhatsapp className="text-2xl text-green-600" />
                </div>
                <span className="text-sm">Send WhatsApp Message</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      
    </div>
  );
}
