"use client";

import React, { useEffect, useState } from "react";
import { MonitorDown } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Registers the PWA service worker on web/desktop browsers (never inside Capacitor)
 * and renders an "Install App" button for Windows/macOS/Linux PCs when available.
 */
export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) return;
      } catch {
        /* web */
      }

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }

      if (window.matchMedia?.("(display-mode: standalone)").matches) {
        if (active) setInstalled(true);
      }
    };

    setup();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (active) setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      if (active) {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      title="Install Stream Freak on your PC or device"
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold transition cursor-pointer shrink-0"
    >
      <MonitorDown className="w-3.5 h-3.5 text-emerald-400" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
