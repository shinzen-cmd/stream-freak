"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Bell,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Send,
  Pause,
  Play,
  X,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
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

interface NotificationFormState {
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
}

const EMPTY_FORM: NotificationFormState = {
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

const TONE_OPTIONS: Array<{
  id: NotificationTone;
  label: string;
  desc: string;
  dot: string;
  activeCls: string;
  Icon: React.ElementType;
}> = [
  {
    id: "info",
    label: "Info",
    desc: "General news",
    dot: "bg-sky-400",
    activeCls: "bg-sky-500/15 border-sky-500/45 text-sky-300",
    Icon: Info,
  },
  {
    id: "success",
    label: "Release",
    desc: "New drops",
    dot: "bg-emerald-400",
    activeCls: "bg-emerald-500/15 border-emerald-500/45 text-emerald-300",
    Icon: CheckCircle2,
  },
  {
    id: "warning",
    label: "Notice",
    desc: "Maintenance",
    dot: "bg-amber-400",
    activeCls: "bg-amber-500/15 border-amber-500/45 text-amber-300",
    Icon: AlertTriangle,
  },
  {
    id: "urgent",
    label: "Urgent",
    desc: "Critical alert",
    dot: "bg-rose-400",
    activeCls: "bg-rose-500/15 border-rose-500/45 text-rose-300",
    Icon: Bell,
  },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hoursFromNowInput(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return toLocalInputValue(d.toISOString());
}

const PRESETS: Array<{ label: string; build: () => NotificationFormState }> = [
  {
    label: "New Drop",
    build: () => ({
      ...EMPTY_FORM,
      title: "New Episodes & Movies Added",
      message: "Fresh releases are now live in 1080p. Tap below to explore what just dropped.",
      tone: "success",
      badge: "NEW DROP",
      cta_label: "Explore Now",
      cta_url: "/explore",
      expires_at: hoursFromNowInput(72),
    }),
  },
  {
    label: "App Update",
    build: () => ({
      ...EMPTY_FORM,
      title: "New Stream Freak Update Available",
      message: "We improved playback speed, added new features, and squashed bugs. Install the latest version for the best experience.",
      tone: "info",
      badge: "UPDATE",
      show_once: true,
      dismissible: true,
    }),
  },
  {
    label: "Maintenance",
    build: () => ({
      ...EMPTY_FORM,
      title: "Scheduled Server Maintenance",
      message: "Some stream mirrors may briefly buffer while we upgrade servers. Switch to Server 2 if needed.",
      tone: "warning",
      badge: "MAINTENANCE",
      show_once: false,
      expires_at: hoursFromNowInput(24),
    }),
  },
  {
    label: "Urgent Alert",
    build: () => ({
      ...EMPTY_FORM,
      title: "Important Announcement",
      message: "Please read this important update from the Stream Freak team.",
      tone: "urgent",
      badge: "IMPORTANT",
      show_once: false,
      dismissible: true,
    }),
  },
];

type FilterTab = "all" | "active" | "paused" | "expired";

function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
        checked
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.04]"
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-white/45 truncate">{hint}</p>
      </div>
      <div
        className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
          checked ? "bg-emerald-500" : "bg-white/15"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

export default function AdminNotificationStudio() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NotificationFormState>(EMPTY_FORM);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showFullscreenTest, setShowFullscreenTest] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setStatusMsg(null);
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
      text: editingId ? "Broadcast updated." : "Broadcast published to all users.",
    });
    setEditingId(null);
    setForm(EMPTY_FORM);
    load();
  };

  const loadIntoForm = (n: AppNotification, asEdit: boolean) => {
    setEditingId(asEdit ? n.id : null);
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
      active: asEdit ? n.active : true,
      expires_at: toLocalInputValue(n.expires_at),
    });
    if (n.image_url || n.cta_label || n.cta_url) {
      setShowAdvanced(true);
    }
    setStatusMsg(
      asEdit
        ? null
        : { type: "ok", text: "Duplicated into composer. Adjust details and publish." }
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const isExpired = (n: AppNotification) =>
    Boolean(n.expires_at && new Date(n.expires_at).getTime() <= Date.now());

  const counts = useMemo(() => {
    let active = 0;
    let paused = 0;
    let expired = 0;
    for (const n of items) {
      if (isExpired(n)) expired++;
      else if (n.active) active++;
      else paused++;
    }
    return { all: items.length, active, paused, expired };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((n) => {
      const exp = isExpired(n);
      if (filterTab === "active" && (!n.active || exp)) return false;
      if (filterTab === "paused" && (n.active || exp)) return false;
      if (filterTab === "expired" && !exp) return false;
      if (q && !n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [items, filterTab, searchQuery]);

  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition";

  return (
    <div className="flex flex-col gap-6">
      {/* Top Studio Header + Quick Presets */}
      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">Broadcast Studio</h2>
            <p className="text-xs text-white/45">
              Create and manage global popup notifications across Phone, TV, and PC.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">
              {counts.active} Live
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/[0.05] text-white/55 border border-white/[0.08] font-medium">
              {counts.all} Total
            </span>
          </div>
        </div>

        {/* 1-Tap Preset Templates */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mr-1">
            Templates:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setEditingId(null);
                const next = p.build();
                setForm(next);
                if (next.cta_label || next.cta_url) setShowAdvanced(true);
                setStatusMsg(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/30 border border-white/[0.08] text-xs font-semibold text-white/75 transition cursor-pointer"
            >
              {p.label}
            </button>
          ))}
          {(form.title || form.message || editingId) && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1.5 rounded-xl text-xs text-white/45 hover:text-white transition cursor-pointer ml-auto"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Composer + Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 bg-[#0e1017] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">
              {editingId ? "Editing Broadcast" : "Compose Popup"}
            </p>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Visual Tone Selector */}
          <div>
            <label className="text-xs text-white/50 block mb-2">Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((t) => {
                const active = form.tone === t.id;
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, tone: t.id })}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? t.activeCls
                        : "bg-white/[0.03] border-white/[0.07] text-white/60 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{t.label}</p>
                      <p className="text-[10px] opacity-65 truncate">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-white/50 block mb-1">Headline *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. New Bollywood & Anime Drops"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Tag (Optional)</label>
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="UPDATE"
                maxLength={24}
                className={inputCls}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">Message *</label>
              <span className="text-[10px] text-white/30">{form.message.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write the message users will see when they open Stream Freak..."
              required
              className={`${inputCls} resize-y`}
            />
          </div>

          {/* Media & Action Button (Collapsible or Open) */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-white/75 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Banner Image & Action Button (Optional)</span>
              </span>
              <span className="text-[11px] text-white/40">{showAdvanced ? "Hide" : "Show"}</span>
            </button>

            {showAdvanced && (
              <div className="p-3.5 pt-1 flex flex-col gap-3 border-t border-white/[0.05]">
                <div>
                  <label className="text-xs text-white/45 block mb-1">Banner Image URL</label>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://image.tmdb.org/t/p/w780/..."
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/45 block mb-1">Button Text</label>
                    <input
                      value={form.cta_label}
                      onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                      placeholder="Watch Now"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/45 block mb-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Button Link
                    </label>
                    <input
                      value={form.cta_url}
                      onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                      placeholder="/anime or https://..."
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Expiry Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs text-white/50 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-white/40" /> Auto-Expire
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: "Never", val: "" },
                  { label: "24h", val: hoursFromNowInput(24) },
                  { label: "3d", val: hoursFromNowInput(72) },
                  { label: "7d", val: hoursFromNowInput(168) },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setForm({ ...form, expires_at: opt.val })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      (opt.val === "" && !form.expires_at)
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/35"
                        : "bg-white/[0.04] text-white/60 border-white/[0.08] hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {form.expires_at && (
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className={inputCls}
              />
            )}
          </div>

          {/* Behavior Toggle Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <ToggleSwitch
              checked={form.active}
              onChange={(v) => setForm({ ...form, active: v })}
              label="Publish Live"
              hint={form.active ? "Visible now" : "Saved paused"}
            />
            <ToggleSwitch
              checked={form.dismissible}
              onChange={(v) => setForm({ ...form, dismissible: v })}
              label="Dismissible"
              hint={form.dismissible ? "Users can close" : "Blocks until action"}
            />
            <ToggleSwitch
              checked={form.show_once}
              onChange={(v) => setForm({ ...form, show_once: v })}
              label="Show Once"
              hint={form.show_once ? "Once per device" : "Every app launch"}
            />
          </div>

          {statusMsg && (
            <div
              className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                statusMsg.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              {saving ? "Saving..." : editingId ? "Save Changes" : "Publish Broadcast"}
            </button>
            <button
              type="button"
              onClick={() => setShowFullscreenTest(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/85 text-sm font-semibold transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Test Popup</span>
            </button>
          </div>
        </form>

        {/* Live Preview Panel */}
        <div className="xl:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Live User Preview
            </span>
            <span className="text-[11px] text-white/35">Phone · TV · PC</span>
          </div>
          <div className="relative p-5 sm:p-6 rounded-2xl bg-[#07080d] border border-white/[0.08] flex items-center justify-center min-h-[280px]">
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

      {/* Broadcast History & Management */}
      <div className="bg-[#0e1017] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "all", label: "All", count: counts.all },
                { id: "active", label: "Live", count: counts.active },
                { id: "paused", label: "Paused", count: counts.paused },
                { id: "expired", label: "Expired", count: counts.expired },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  filterTab === t.id
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                    : "bg-white/[0.04] text-white/55 border border-white/[0.06] hover:text-white"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Search + Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search broadcasts..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              type="button"
              onClick={load}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-emerald-400 cursor-pointer shrink-0"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/40">
            {loading ? "Loading broadcasts..." : "No notifications match this filter."}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filteredItems.map((n) => {
              const expired = isExpired(n);
              return (
                <div
                  key={n.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          expired
                            ? "bg-amber-500/15 text-amber-300"
                            : n.active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-white/5 text-white/45"
                        }`}
                      >
                        {expired ? "Expired" : n.active ? "Live" : "Paused"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-white/[0.05] text-white/60">
                        {n.tone}
                      </span>
                      {n.badge && (
                        <span className="text-[10px] font-bold uppercase text-white/50">
                          {n.badge}
                        </span>
                      )}
                      <span className="text-[11px] text-white/35">
                        · {n.show_once ? "Show once" : "Every launch"}
                        {n.dismissible ? "" : " · Mandatory"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                    <p className="text-xs text-white/50 line-clamp-2 mt-0.5">{n.message}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!expired && (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(n)}
                        title={n.active ? "Pause broadcast" : "Activate broadcast"}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white/80 cursor-pointer"
                      >
                        {n.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{n.active ? "Pause" : "Go Live"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadIntoForm(n, false)}
                      title="Duplicate into composer"
                      className="p-2 rounded-lg text-white/50 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => loadIntoForm(n, true)}
                      title="Edit broadcast"
                      className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n.id)}
                      title="Delete broadcast"
                      className="p-2 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Interactive Test Modal */}
      {showFullscreenTest && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setShowFullscreenTest(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Fullscreen Test Preview
              </span>
              <button
                type="button"
                onClick={() => setShowFullscreenTest(false)}
                className="p-1 rounded-lg bg-white/10 text-white/70 hover:text-white cursor-pointer"
                aria-label="Close test preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <NotificationPopupCard
              title={form.title}
              message={form.message}
              tone={form.tone}
              badge={form.badge}
              imageUrl={form.image_url}
              ctaLabel={form.cta_label}
              ctaUrl={form.cta_url}
              dismissible={form.dismissible}
              onDismiss={() => setShowFullscreenTest(false)}
              onAction={() => setShowFullscreenTest(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
