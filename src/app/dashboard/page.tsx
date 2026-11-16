"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Settings, LogOut,
  Trash2, RefreshCw, Server, BarChart3, Shield,
  Bell, Search, Pencil, Plus, Bookmark, History, CheckCircle2,
} from "lucide-react";
import { getSession, signOut, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  AppNotification,
  NotificationInput,
  NotificationTone,
  fetchAllNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
} from "@/lib/notifications";
import NotificationPopupCard from "@/components/NotificationPopupCard";

/* ── types ──────────────────────────────────────────────────── */
interface UserRow {
  id: string;
  email: string;
  role: string;
  joined: string;
}

interface DashboardStats {
  totalUsers: number;
  activeNotifications: number;
  totalWatchlistItems: number;
  totalHistoryItems: number;
  recentUsers: UserRow[];
}

const NAV_ITEMS = [
  { id: "overview",      label: "Overview",      icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell      },
  { id: "users",         label: "Users",         icon: Users     },
  { id: "servers",       label: "Servers",       icon: Server    },
  { id: "settings",      label: "Settings",      icon: Settings  },
];

/* ── component ──────────────────────────────────────────────── */
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    getSession().then((s) => {
      if (!s || s.role !== "admin") { router.replace("/login"); return; }
      setUser(s);
    });
  }, [router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#090a0f] text-white flex pt-[calc(4.25rem+env(safe-area-inset-top,0px))] md:pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-24">
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left w-full cursor-pointer
                  ${active ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "text-white/60 hover:text-white hover:bg-white/[0.05]"}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
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

      {/* ── Main ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Easy-to-use Header + Mobile/Tablet Quick Tabs */}
        <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] xs:top-[calc(4rem+env(safe-area-inset-top,0px))] md:top-[calc(5rem+env(safe-area-inset-top,0px))] z-20 bg-[#090a0f]/95 backdrop-blur-xl border-b border-white/[0.07] px-4 sm:px-6 py-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">
                  {NAV_ITEMS.find((n) => n.id === tab)?.label}
                </h1>
              </div>
            </div>
            <button
              onClick={() => setTab("notifications")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Popup</span>
            </button>
          </div>

          {/* Horizontal Quick Tabs (Mobile & Tablet) */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 cursor-pointer ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                      : "bg-white/[0.04] text-white/60 border border-white/[0.06] hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto">
          {tab === "overview"      && <OverviewTab onOpenTab={setTab} />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "users"         && <UsersTab />}
          {tab === "servers"       && <ServersTab />}
          {tab === "settings"      && <SettingsTab user={user} onSignOut={handleSignOut} />}
        </main>
      </div>
    </div>
  );
}

/* ── Sub-tabs ─────────────────────────────────────────────── */
function OverviewTab({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, notifsRes, userDataRes] = await Promise.all([
      supabase.from("profiles").select("id,email,role,created_at").order("created_at", { ascending: false }),
      supabase.from("notifications").select("id,active,expires_at").eq("active", true),
      supabase.from("user_data").select("watchlist,history"),
    ]);

    const profiles = (profilesRes.data ?? []).map((r) => ({
      id: r.id,
      email: r.email ?? "Unknown",
      role: r.role ?? "user",
      joined: String(r.created_at ?? "").slice(0, 10),
    }));

    const now = Date.now();
    const activeNotifs = (notifsRes.data ?? []).filter(
      (n) => !n.expires_at || new Date(n.expires_at).getTime() > now
    ).length;

    let totalWatchlistItems = 0;
    let totalHistoryItems = 0;
    for (const row of userDataRes.data ?? []) {
      if (Array.isArray(row.watchlist)) totalWatchlistItems += row.watchlist.length;
      if (Array.isArray(row.history)) totalHistoryItems += row.history.length;
    }

    setStats({
      totalUsers: profiles.length,
      activeNotifications: activeNotifs,
      totalWatchlistItems,
      totalHistoryItems,
      recentUsers: profiles.slice(0, 5),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    { label: "Registered Users",     value: stats ? String(stats.totalUsers) : "—",          icon: Users,    color: "text-emerald-400", tab: "users" },
    { label: "Active Popups",        value: stats ? String(stats.activeNotifications) : "—", icon: Bell,     color: "text-sky-400",     tab: "notifications" },
    { label: "Saved Watchlist Items", value: stats ? String(stats.totalWatchlistItems) : "—", icon: Bookmark, color: "text-violet-400",  tab: "overview" },
    { label: "Watch History Entries", value: stats ? String(stats.totalHistoryItems) : "—",   icon: History,  color: "text-amber-400",   tab: "overview" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/45">Live data from Supabase</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Real Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onOpenTab(s.tab)}
              className="text-left bg-[#0e1017] hover:bg-[#121520] border border-white/[0.07] rounded-2xl p-4 transition cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/50">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </button>
          );
        })}
      </div>

      {/* Real Recent Signups */}
      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Recent Accounts</p>
          <button
            onClick={() => onOpenTab("users")}
            className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            View All
          </button>
        </div>
        {loading && !stats ? (
          <p className="text-xs text-white/40 py-2">Loading...</p>
        ) : !stats?.recentUsers.length ? (
          <p className="text-xs text-white/40 py-2">No accounts found.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-xs text-white/80 truncate">{u.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                    {u.role}
                  </span>
                  <span className="text-[11px] text-white/40">{u.joined}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,email,role,created_at")
      .order("created_at", { ascending: false });
    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        email: r.email ?? "",
        role: r.role ?? "user",
        joined: String(r.created_at ?? "").slice(0, 10),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = query.trim()
    ? rows.filter((u) => u.email.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  return (
    <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-white/[0.07]">
        <p className="text-sm font-semibold">Registered Users ({filtered.length})</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by email..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-emerald-400 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05] text-white/40">
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-white/40">
                  {loading ? "Loading users..." : "No matching users."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/85">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === "admin"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-white/5 text-white/55"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/45">{u.joined}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServersTab() {
  const servers = [
    { category: "Anime", name: "Server 1 (Primary)", host: "zokoanime.video/stream" },
    { category: "Anime", name: "Server 2 (Backup)",  host: "vidnest.fun/anime" },
    { category: "Anime", name: "Server 3 (Fallback)", host: "vidsrc.cc/v2/embed/anime" },
    { category: "Movies / TV", name: "Server 1 (Primary)", host: "vidrock.net" },
    { category: "Movies / TV", name: "Server 2 (Backup)",  host: "vidlink.pro" },
    { category: "Movies / TV", name: "Server 3 (Fallback)", host: "multiembed.mov" },
  ];

  return (
    <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.07]">
        <p className="text-sm font-semibold">Configured Stream Servers ({servers.length})</p>
      </div>
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {servers.map((sv) => (
          <div key={`${sv.category}-${sv.name}`} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{sv.name}</p>
              <p className="text-xs text-white/45 truncate">{sv.host}</p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/[0.05] text-white/65 shrink-0">
              {sv.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  return (
    <div className="max-w-lg flex flex-col gap-4">
      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">Admin Account</p>
        <div>
          <label className="text-xs text-white/40 block mb-1">Signed in as</label>
          <input
            value={user.email}
            readOnly
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-sm text-white/80 outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Role</label>
          <input
            value={user.role.toUpperCase()}
            readOnly
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-bold outline-none"
          />
        </div>
      </div>

      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Supabase Connected</p>
            <p className="text-xs text-white/45">Auth, profiles, user data, and notifications active</p>
          </div>
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-sm font-bold transition cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}

const EMPTY_FORM: {
  title: string;
  message: string;
  tone: NotificationTone;
  badge: string;
  image_url: string;
  cta_label: string;
  cta_url: string;
  dismissible: boolean;
  show_once: boolean;
  active: boolean;
  expires_at: string;
} = {
  title: "",
  message: "",
  tone: "info",
  badge: "",
  image_url: "",
  cta_label: "",
  cta_url: "",
  dismissible: true,
  show_once: true,
  active: true,
  expires_at: "",
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NotificationsTab() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchAllNotifications();
    if (error) {
      setStatusMsg({ type: "err", text: error });
    }
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!form.title.trim() || !form.message.trim()) {
      setStatusMsg({ type: "err", text: "Title and message are required." });
      return;
    }

    setSaving(true);
    const payload: NotificationInput = {
      title: form.title.trim(),
      message: form.message.trim(),
      tone: form.tone,
      badge: form.badge.trim() || null,
      image_url: form.image_url.trim() || null,
      cta_label: form.cta_label.trim() || null,
      cta_url: form.cta_url.trim() || null,
      dismissible: form.dismissible,
      show_once: form.show_once,
      active: form.active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    const res = editingId
      ? await updateNotification(editingId, payload)
      : await createNotification(payload);

    setSaving(false);
    if (res.error) {
      setStatusMsg({ type: "err", text: res.error });
      return;
    }

    setStatusMsg({
      type: "ok",
      text: editingId ? "Notification updated." : "Notification published.",
    });
    resetForm();
    load();
  };

  const handleEdit = (n: AppNotification) => {
    setEditingId(n.id);
    setForm({
      title: n.title,
      message: n.message,
      tone: n.tone,
      badge: n.badge ?? "",
      image_url: n.image_url ?? "",
      cta_label: n.cta_label ?? "",
      cta_url: n.cta_url ?? "",
      dismissible: n.dismissible,
      show_once: n.show_once,
      active: n.active,
      expires_at: toLocalInputValue(n.expires_at),
    });
    setStatusMsg(null);
  };

  const handleToggleActive = async (n: AppNotification) => {
    const { error } = await updateNotification(n.id, { active: !n.active });
    if (error) {
      setStatusMsg({ type: "err", text: error });
      return;
    }
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteNotification(id);
    if (error) {
      setStatusMsg({ type: "err", text: error });
      return;
    }
    if (editingId === id) resetForm();
    load();
  };

  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition";

  return (
    <div className="flex flex-col gap-6">
      {/* Builder + Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              {editingId ? "Edit Popup Notification" : "Create Popup Notification"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-white/50 hover:text-white cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Server Maintenance Notice"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Tag / Label (Optional)</label>
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="UPDATE"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Message *</label>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write the popup message all users will see..."
              required
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Style / Tone</label>
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value as NotificationTone })}
                className={`${inputCls} bg-[#0e1017]`}
              >
                <option value="info">Info (Blue)</option>
                <option value="success">Success (Emerald)</option>
                <option value="warning">Warning (Amber)</option>
                <option value="urgent">Urgent (Red)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Expires At (Optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Banner Image URL (Optional)</label>
            <input
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://example.com/banner.jpg"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Action Button Label (Optional)</label>
              <input
                value={form.cta_label}
                onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                placeholder="Explore Anime"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Action Button Link (Optional)</label>
              <input
                value={form.cta_url}
                onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                placeholder="/anime or https://..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Behavior Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {[
              { key: "active" as const, label: "Active Now" },
              { key: "dismissible" as const, label: "Dismissible" },
              { key: "show_once" as const, label: "Show Once Per User" },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] cursor-pointer text-xs font-medium text-white/80"
              >
                <input
                  type="checkbox"
                  checked={form[opt.key]}
                  onChange={(e) => setForm({ ...form, [opt.key]: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4 rounded"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {statusMsg && (
            <p className={`text-xs font-medium ${statusMsg.type === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
              {statusMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {saving ? "Saving..." : editingId ? "Save Changes" : "Publish Notification"}
          </button>
        </form>

        {/* Live Preview */}
        <div className="xl:col-span-5 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            Live Popup Preview
          </p>
          <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-center">
            <NotificationPopupCard
              title={form.title}
              message={form.message}
              tone={form.tone}
              badge={form.badge}
              imageUrl={form.image_url}
              ctaLabel={form.cta_label}
              ctaUrl={form.cta_url}
              dismissible={form.dismissible}
              isPreview
            />
          </div>
        </div>
      </div>

      {/* Existing Notifications List */}
      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.07]">
          <p className="text-sm font-semibold">All Notifications ({items.length})</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/40">
            {loading ? "Loading notifications..." : "No notifications created yet."}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {items.map((n) => (
              <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        n.active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/40"
                      }`}
                    >
                      {n.active ? "Active" : "Paused"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-white/5 text-white/60">
                      {n.tone}
                    </span>
                    {n.badge && (
                      <span className="text-[10px] font-bold uppercase text-white/50">[{n.badge}]</span>
                    )}
                    <span className="text-[11px] text-white/35">
                      {n.show_once ? "Show once" : "Every launch"}
                      {n.dismissible ? "" : " · Non-dismissible"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                  <p className="text-xs text-white/50 line-clamp-2">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(n)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white/80 cursor-pointer"
                  >
                    {n.active ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleEdit(n)}
                    title="Edit"
                    className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
