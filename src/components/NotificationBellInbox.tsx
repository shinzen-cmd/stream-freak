"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Bell, BellRing, Check, ExternalLink, Sparkles, X } from "lucide-react";
import { AppNotification, fetchActiveNotifications } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { recordAlertsOptInReward } from "@/lib/rewards";
import { isTvDevice } from "@/lib/device";

const SEEN_KEY = "sf_inbox_last_seen";

const TONE_DOT: Record<string, string> = {
  info: "bg-sky-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  urgent: "bg-rose-400",
};

export default function NotificationBellInbox() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState<"unknown" | "granted" | "prompt" | "denied">("unknown");
  const [showSettingsHint, setShowSettingsHint] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const isNative = Capacitor.isNativePlatform();

    fetchActiveNotifications()
      .then((list) => {
        if (!active) return;
        const filtered = list.filter((n) => {
          const t = n.target_platform || "all";
          if (t === "android" && !isNative) return false;
          if (t === "web" && isNative) return false;
          return true;
        });
        setItems(filtered.slice(0, 15));

        try {
          const lastSeen = Number(localStorage.getItem(SEEN_KEY) || "0");
          const unread = filtered.filter((n) => new Date(n.created_at).getTime() > lastSeen).length;
          setUnreadCount(unread);
        } catch {
          setUnreadCount(filtered.length > 0 ? 1 : 0);
        }
      })
      .catch(() => {});

    if (isNative && !isTvDevice()) {
      import("@capacitor/push-notifications")
        .then(({ PushNotifications }) => PushNotifications.checkPermissions())
        .then((res) => {
          if (!active) return;
          if (res.receive === "granted") setPushState("granted");
          else if (res.receive === "denied") setPushState("denied");
          else setPushState("prompt");
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        try {
          localStorage.setItem(SEEN_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  const handleEnablePush = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const req = await PushNotifications.requestPermissions();
      if (req.receive === "granted") {
        setPushState("granted");
        setShowSettingsHint(false);
        await PushNotifications.register();
        recordAlertsOptInReward(user?.uid ?? null);
      } else {
        setPushState("denied");
        setShowSettingsHint(true);
      }
    } catch {
      setShowSettingsHint(true);
    }
  };

  const handleOpenLink = (url: string) => {
    setOpen(false);
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      window.open(trimmed, "_blank", "noopener,noreferrer");
    } else {
      router.push(trimmed);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition cursor-pointer"
      >
        <Bell className="w-4 h-4 text-emerald-400" />
        {(unreadCount > 0 || pushState === "prompt" || pushState === "denied") && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
            {unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : "!"}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[75vh] bg-[#0e1118] border border-white/15 rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Stream Freak Alerts
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close alerts"
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Native Android Push Opt-In Nudge (+25 XP) */}
          {(pushState === "prompt" || pushState === "denied") && (
            <div className="p-3.5 bg-emerald-500/[0.08] border-b border-emerald-500/20 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Never Miss New Drops (+25 XP)
                  </p>
                  <p className="text-[11px] text-white/60 leading-snug">
                    Turn on phone alerts for trending movies &amp; new anime episodes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 transition cursor-pointer"
                >
                  Enable
                </button>
              </div>
              {showSettingsHint && (
                <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                  Alerts were blocked earlier. Open <strong>Phone Settings → Apps → Stream Freak → Notifications → Allow</strong>.
                </p>
              )}
            </div>
          )}

          {pushState === "granted" && (
            <div className="px-4 py-2 bg-emerald-500/[0.05] border-b border-white/[0.06] flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
              <Check className="w-3.5 h-3.5" />
              Phone push alerts are active
            </div>
          )}

          {/* In-App Alerts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {items.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-white/45">
                You&apos;re all caught up! New drops and updates will appear here.
              </div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="p-3.5 hover:bg-white/[0.02] transition space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[n.tone] || "bg-emerald-400"}`} />
                      <p className="text-xs font-bold text-white truncate">{n.title}</p>
                    </div>
                    {n.badge && (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold uppercase text-white/70 shrink-0">
                        {n.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/65 leading-relaxed">{n.message}</p>
                  {n.cta_url && (
                    <button
                      type="button"
                      onClick={() => handleOpenLink(n.cta_url!)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 pt-0.5 cursor-pointer"
                    >
                      <span>{n.cta_label || "Open"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
