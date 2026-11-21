"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Settings,
  LogOut,
  RefreshCw,
  Server,
  BarChart3,
  Shield,
  Bell,
  Search,
  Plus,
  Bookmark,
  History,
  CheckCircle2,
  Crown,
  Ban,
  Inbox,
  Trash2,
  Flame,
  Wrench,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { getSession, signOut, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/apiBase";
import { getLevelInfo } from "@/lib/rewards";
import { DEFAULT_SITE_CONFIG, SiteConfig } from "@/lib/siteConfig";
import AdminNotificationStudio from "@/components/AdminNotificationStudio";

interface ManagedUser {
  id: string;
  email: string;
  role: string;
  banned: boolean;
  created_at: string;
  xp: number;
  streak: number;
  watch_count: number;
  watchlist_count: number;
  special_badges: string[];
}

interface UserRequestRow {
  id: string;
  category: string;
  sender_name: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface TopWatchedItem {
  title: string;
  type: string;
  count: number;
}

interface DashboardData {
  users: ManagedUser[];
  requests: UserRequestRow[];
  requestsReady: boolean;
  config: SiteConfig;
  configReady: boolean;
  topWatched: TopWatchedItem[];
  activeNotifications: number;
  totalWatchlistItems: number;
  totalHistoryItems: number;
}

const STREAM_SERVERS = [
  { id: "vidrock", name: "VidRock", group: "Movies & TV", tier: "Primary" },
  { id: "vidlink", name: "VidLink Pro", group: "Movies & TV", tier: "Backup 1" },
  { id: "multiembed", name: "MultiEmbed", group: "Movies & TV", tier: "Backup 2" },
  { id: "zokoanime", name: "ZokoAnime", group: "Anime", tier: "Primary" },
  { id: "vidnest", name: "VidNest", group: "Anime", tier: "Backup 1" },
  { id: "vidsrc", name: "VidSrc", group: "Anime", tier: "Backup 2" },
];

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "users", label: "Users", icon: Users },
  { id: "requests", label: "Requests", icon: Inbox },
  { id: "servers", label: "Servers", icon: Server },
  { id: "settings", label: "Controls", icon: Settings },
];

function SwitchRow({
  label,
  hint,
  checked,
  danger,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  danger?: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border text-left transition cursor-pointer ${
        checked
          ? danger
            ? "bg-rose-500/10 border-rose-500/35"
            : "bg-emerald-500/10 border-emerald-500/30"
          : "bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.04]"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-white/50 mt-0.5">{hint}</p>
      </div>
      <div
        className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
          checked ? (danger ? "bg-rose-500" : "bg-emerald-500") : "bg-white/15"
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DashboardData>({
    users: [],
    requests: [],
    requestsReady: true,
    config: DEFAULT_SITE_CONFIG,
    configReady: true,
    topWatched: [],
    activeNotifications: 0,
    totalWatchlistItems: 0,
    totalHistoryItems: 0,
  });

  useEffect(() => {
    getSession().then((s) => {
      if (!s || s.role !== "admin") {
        router.replace("/login");
        return;
      }
      setUser(s);
    });
  }, [router]);

  const authHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [manageRes, notifCountRes] = await Promise.all([
        fetch(apiUrl("/api/admin/manage"), { headers }),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("active", true),
      ]);

      const manageJson = manageRes.ok ? await manageRes.json() : null;
      const users: ManagedUser[] = manageJson?.users ?? [];
      const totalWatchlistItems = users.reduce((sum, u) => sum + (u.watchlist_count || 0), 0);
      const totalHistoryItems = users.reduce((sum, u) => sum + (u.watch_count || 0), 0);

      setData({
        users,
        requests: manageJson?.requests ?? [],
        requestsReady: manageJson?.requestsReady !== false,
        config: manageJson?.config ?? DEFAULT_SITE_CONFIG,
        configReady: manageJson?.configReady !== false,
        topWatched: manageJson?.topWatched ?? [],
        activeNotifications: notifCountRes.count ?? 0,
        totalWatchlistItems,
        totalHistoryItems,
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  const runAction = async (key: string, body: Record<string, unknown>, successText: string) => {
    setBusyId(key);
    setToast(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(apiUrl("/api/admin/manage"), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast({ type: "err", text: json.error || "Action failed." });
      } else {
        setToast({ type: "ok", text: successText });
        await loadAll();
      }
    } catch {
      setToast({ type: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [router]);

  if (!user) return null;

  const openRequestsCount = data.requests.filter((r) => r.status !== "done").length;
  const filteredUsers = data.users.filter((u) =>
    u.email.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#090a0f] text-white flex pt-[calc(4.25rem+env(safe-area-inset-top,0px))] md:pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-24">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-[#0e1017] border-r border-white/[0.07] flex-col shrink-0">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Admin Panel</p>
          <p className="text-xs text-white/50 truncate mt-0.5">{user.email}</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left w-full cursor-pointer ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                    : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </span>
                {item.id === "requests" && openRequestsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-black">
                    {openRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-white/[0.07] pt-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-white/50 hover:text-rose-400 hover:bg-rose-500/5 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] xs:top-[calc(4rem+env(safe-area-inset-top,0px))] md:top-[calc(5rem+env(safe-area-inset-top,0px))] z-20 bg-[#090a0f]/95 backdrop-blur-xl border-b border-white/[0.07] px-4 sm:px-6 py-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white truncate">
                {NAV_ITEMS.find((n) => n.id === tab)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAll()}
                className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/70 hover:text-white transition cursor-pointer"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setTab("notifications")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Broadcast</span>
              </button>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition shrink-0 cursor-pointer ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.04] text-white/60 border border-white/[0.06]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.id === "requests" && openRequestsCount > 0 && (
                    <span className="px-1.5 rounded-full bg-emerald-500 text-black text-[10px] font-bold">
                      {openRequestsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto flex flex-col gap-5">
          {toast && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
                toast.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {toast.text}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total Users", value: data.users.length, icon: Users, color: "text-emerald-400" },
                  { label: "Live Broadcasts", value: data.activeNotifications, icon: Bell, color: "text-sky-400" },
                  { label: "Open Requests", value: openRequestsCount, icon: Inbox, color: "text-amber-400" },
                  { label: "Saved Items", value: data.totalWatchlistItems, icon: Bookmark, color: "text-violet-400" },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">{c.label}</span>
                        <Icon className={`w-4 h-4 ${c.color}`} />
                      </div>
                      <span className="text-2xl font-black text-white">{c.value}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Most Watched Titles */}
                <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white">Most Watched Across Users</h2>
                  </div>
                  {data.topWatched.length === 0 ? (
                    <p className="text-xs text-white/40 py-4">No watch history synced yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.topWatched.map((t, i) => (
                        <div
                          key={t.title}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs font-mono font-bold text-emerald-400 w-5">#{i + 1}</span>
                            <span className="text-xs font-semibold text-white truncate">{t.title}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-white/50 shrink-0">
                            {t.count} {t.count === 1 ? "play" : "plays"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Signups */}
                <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-sky-400" />
                    <h2 className="text-sm font-bold text-white">Recent Members</h2>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.users.slice(0, 6).map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.email}</p>
                          <p className="text-[10px] text-white/40">
                            Lv.{getLevelInfo(u.xp).level} · {u.xp} XP · {u.streak}d streak
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === "admin"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {tab === "notifications" && <AdminNotificationStudio />}

          {/* USERS TAB (Role, Ban, Exclusive Badges!) */}
          {tab === "users" && (
            <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Member Management</h2>
                  <p className="text-xs text-white/45">
                    Grant exclusive VIP / Founder / Beta badges, manage roles, or suspend abusive accounts.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by email..."
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {filteredUsers.map((u) => {
                  const lvl = getLevelInfo(u.xp);
                  const isSelf = u.id === user.uid;
                  return (
                    <div
                      key={u.id}
                      className={`rounded-xl p-3.5 border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        u.banned
                          ? "bg-rose-500/[0.06] border-rose-500/25"
                          : "bg-white/[0.025] border-white/[0.07]"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{u.email}</span>
                          {u.role === "admin" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              ADMIN
                            </span>
                          )}
                          {u.banned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                              BANNED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 flex flex-wrap items-center gap-2">
                          <span>Lv.{lvl.level} {lvl.title} ({u.xp} XP)</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Flame className="w-3 h-3" /> {u.streak}d
                          </span>
                          <span>•</span>
                          <span>{u.watchlist_count} saved</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["vip", "founder", "beta"] as const).map((badge) => {
                          const has = u.special_badges.includes(badge);
                          return (
                            <button
                              key={badge}
                              type="button"
                              disabled={busyId === `${u.id}:${badge}`}
                              onClick={() =>
                                void runAction(
                                  `${u.id}:${badge}`,
                                  { action: "grant_badge", userId: u.id, badge },
                                  has ? `Removed ${badge.toUpperCase()} badge.` : `Granted ${badge.toUpperCase()} badge!`
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                has
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                  : "bg-white/[0.04] border-white/10 text-white/45 hover:text-white"
                              }`}
                            >
                              <Crown className="w-3 h-3" />
                              {badge.toUpperCase()}
                            </button>
                          );
                        })}

                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === `${u.id}:role`}
                              onClick={() =>
                                void runAction(
                                  `${u.id}:role`,
                                  {
                                    action: "toggle_role",
                                    userId: u.id,
                                    role: u.role === "admin" ? "user" : "admin",
                                  },
                                  u.role === "admin" ? "Demoted to user." : "Promoted to Admin."
                                )
                              }
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/75 cursor-pointer"
                            >
                              {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === `${u.id}:ban`}
                              onClick={() =>
                                void runAction(
                                  `${u.id}:ban`,
                                  { action: "toggle_ban", userId: u.id, banned: !u.banned },
                                  u.banned ? "User unbanned." : "User suspended."
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              {u.banned ? "Unban" : "Ban"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* REQUESTS INBOX TAB */}
          {tab === "requests" && (
            <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-white">User Requests &amp; Reports</h2>
                <p className="text-xs text-white/45">
                  Movie/Anime requests, bug reports, and ideas submitted from /contact.
                </p>
              </div>

              {data.requests.length === 0 ? (
                <p className="text-xs text-white/45 py-8 text-center">No user requests yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {data.requests.map((r) => {
                    const isDone = r.status === "done";
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          isDone
                            ? "bg-white/[0.015] border-white/[0.05] opacity-65"
                            : "bg-white/[0.03] border-white/[0.08]"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300">
                              {r.category}
                            </span>
                            <span className="text-sm font-bold text-white">{r.subject}</span>
                          </div>
                          <p className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed">
                            {r.message}
                          </p>
                          <p className="text-[11px] text-white/40">
                            From {r.sender_name} · {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                `req:${r.id}`,
                                { action: "resolve_request", id: r.id, status: isDone ? "open" : "done" },
                                isDone ? "Reopened request." : "Marked as done!"
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isDone ? "Reopen" : "Mark Done"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                `del:${r.id}`,
                                { action: "delete_request", id: r.id },
                                "Request deleted."
                              )
                            }
                            className="p-1.5 rounded-lg text-white/45 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            aria-label="Delete request"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SERVERS TAB */}
          {tab === "servers" && (
            <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Live Streaming Mirrors</h2>
                <p className="text-xs text-white/45">
                  Toggle embed mirrors on or off across Stream Freak if a provider goes down.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STREAM_SERVERS.map((s) => {
                  const enabled = !data.config.disabled_servers.includes(s.id);
                  return (
                    <SwitchRow
                      key={s.id}
                      label={`${s.name} (${s.group})`}
                      hint={`${s.tier} • ${enabled ? "Active for users" : "Disabled"}`}
                      checked={enabled}
                      onChange={(nextEnabled) => {
                        const disabled = nextEnabled
                          ? data.config.disabled_servers.filter((id) => id !== s.id)
                          : [...data.config.disabled_servers, s.id];
                        const nextCfg = { ...data.config, disabled_servers: disabled };
                        setData((prev) => ({ ...prev, config: nextCfg }));
                        void runAction(
                          `srv:${s.id}`,
                          { action: "save_config", config: nextCfg },
                          `${s.name} ${nextEnabled ? "enabled" : "disabled"}.`
                        );
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* CONTROLS / SETTINGS TAB */}
          {tab === "settings" && (
            <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold text-white">Live Platform Controls</h2>
                  <p className="text-xs text-white/45">
                    Changes take effect immediately across Web and Android APK.
                  </p>
                </div>
              </div>

              <SwitchRow
                label="Global Maintenance Mode"
                hint="Shows a tune-up screen to all users while keeping /dashboard open for you"
                checked={data.config.maintenance_mode}
                danger
                onChange={(v) =>
                  setData((prev) => ({ ...prev, config: { ...prev.config, maintenance_mode: v } }))
                }
              />

              {data.config.maintenance_mode && (
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Maintenance Message</label>
                  <input
                    value={data.config.maintenance_message}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        config: { ...prev.config, maintenance_message: e.target.value },
                      }))
                    }
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SwitchRow
                  label="Watch Party Rooms"
                  hint="Allow users to host and join private screenings"
                  checked={data.config.watch_party_enabled}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, config: { ...prev.config, watch_party_enabled: v } }))
                  }
                />
                <SwitchRow
                  label="Downloads Button"
                  hint="Show download options on movie & anime pages"
                  checked={data.config.downloads_enabled}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, config: { ...prev.config, downloads_enabled: v } }))
                  }
                />
                <SwitchRow
                  label="Guest Browsing"
                  hint="Let visitors watch before signing in"
                  checked={data.config.guest_mode_enabled}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, config: { ...prev.config, guest_mode_enabled: v } }))
                  }
                />
                <SwitchRow
                  label="New Account Signups"
                  hint="Allow new users to create accounts"
                  checked={data.config.signups_enabled}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, config: { ...prev.config, signups_enabled: v } }))
                  }
                />
              </div>

              <button
                type="button"
                disabled={busyId === "save_cfg"}
                onClick={() =>
                  void runAction(
                    "save_cfg",
                    { action: "save_config", config: data.config },
                    "Platform controls saved live!"
                  )
                }
                className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {busyId === "save_cfg" && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Live Controls
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
