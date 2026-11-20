"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Bell, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { isTvDevice } from "@/lib/device";

interface ForegroundToast {
  title: string;
  body: string;
  url?: string;
  image?: string;
}

const CHANNEL_ID = "stream_freak_general";
const TOKEN_STORAGE_KEY = "sf_fcm_token";

async function savePushTokenToSupabase(token: string, userId: string | null) {
  try {
    const platform = Capacitor.getPlatform();
    const { error } = await supabase.from("push_tokens").upsert(
      {
        token,
        user_id: userId,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );
    if (error) {
      console.warn("[Push] Failed to upsert token:", error.message);
    }
  } catch (err) {
    console.warn("[Push] Token save error:", err);
  }
}

export default function PushNotificationRegistrar() {
  const router = useRouter();
  const { user } = useAuth();
  const [toast, setToast] = useState<ForegroundToast | null>(null);
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Keep latest user id and re-link stored token when user signs in/out
  useEffect(() => {
    const uid = user?.uid ?? null;
    userIdRef.current = uid;
    if (!Capacitor.isNativePlatform() || isTvDevice()) return;
    try {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedToken) {
        void savePushTokenToSupabase(savedToken, uid);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [user?.uid]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!Capacitor.isNativePlatform() || isTvDevice()) return;
    initializedRef.current = true;

    let cleanupFns: Array<() => Promise<void>> = [];

    const setup = async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Create high-priority Android notification channel (Android 8+)
        try {
          await PushNotifications.createChannel({
            id: CHANNEL_ID,
            name: "Stream Freak Alerts",
            description: "New drops, episodes, and important updates from Stream Freak",
            importance: 5,
            visibility: 1,
            sound: "default",
            vibration: true,
          });
        } catch {
          /* createChannel is Android-only; ignore elsewhere */
        }

        const permStatus = await PushNotifications.checkPermissions();
        let receive = permStatus.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          const req = await PushNotifications.requestPermissions();
          receive = req.receive;
        }
        if (receive !== "granted") return;

        const regListener = await PushNotifications.addListener("registration", async (token) => {
          if (!token?.value) return;
          try {
            localStorage.setItem(TOKEN_STORAGE_KEY, token.value);
          } catch {
            /* ignore */
          }
          await savePushTokenToSupabase(token.value, userIdRef.current);
        });

        const errListener = await PushNotifications.addListener("registrationError", (err) => {
          console.warn("[Push] Registration error:", err);
        });

        const recvListener = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          const data = (notification.data ?? {}) as Record<string, string | undefined>;
          const title = notification.title || data.title || "Stream Freak";
          const body = notification.body || data.body || "";
          const url = data.url || data.cta_url;
          const image = data.image;
          if (!title && !body) return;

          setToast({ title, body, url, image });
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 6500);
        });

        const tapListener = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = (action.notification?.data ?? {}) as Record<string, string | undefined>;
          const url = data.url || data.cta_url;
          if (!url) return;
          if (url.startsWith("/")) {
            router.push(url);
          } else if (/^https?:\/\//i.test(url)) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        });

        cleanupFns = [
          () => regListener.remove(),
          () => errListener.remove(),
          () => recvListener.remove(),
          () => tapListener.remove(),
        ];

        await PushNotifications.register();
      } catch (err) {
        console.warn("[Push] Setup skipped:", err);
      }
    };

    void setup();

    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      cleanupFns.forEach((fn) => void fn());
    };
  }, [router]);

  if (!toast) return null;

  const handleOpen = () => {
    const url = toast.url;
    setToast(null);
    if (!url) return;
    if (url.startsWith("/")) {
      router.push(url);
    } else if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,0px)+12px)] left-3 right-3 z-[90] flex justify-center pointer-events-none">
      <div
        onClick={toast.url ? handleOpen : undefined}
        className={`pointer-events-auto w-full max-w-md rounded-2xl bg-[#111520]/95 backdrop-blur-xl border border-emerald-500/30 shadow-2xl p-3.5 flex items-start gap-3 ${
          toast.url ? "cursor-pointer hover:border-emerald-400/50 transition" : ""
        }`}
      >
        {toast.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toast.image}
            alt=""
            className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{toast.title}</p>
          {toast.body && <p className="text-xs text-white/70 line-clamp-2 mt-0.5">{toast.body}</p>}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            setToast(null);
          }}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
