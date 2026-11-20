"use client";

import React, { useEffect, useState } from "react";
import { Download, MonitorDown, Smartphone, Laptop, X, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const APK_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL ||
  "https://github.com/shinzen-cmd/stream-freak/releases/latest/download/StreamFreak.apk";

/**
 * Registers the PWA service worker on web browsers (never inside Capacitor APK)
 * and shows a "Get App" button offering both:
 *  1) Android Phone & Android TV APK download (GitHub Releases permanent link)
 *  2) PC / Laptop / iPhone Web App (PWA) install
 */
export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [pcHint, setPcHint] = useState(false);

  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          if (active) setHidden(true);
          return;
        }
      } catch {
        /* web */
      }

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }

      const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
      if (active) {
        setHidden(Boolean(isStandalone));
      }
    };

    void setup();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (active) setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      if (active) {
        setHidden(true);
        setDeferredPrompt(null);
        setOpen(false);
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  const handlePcInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setHidden(true);
          setOpen(false);
        }
        setDeferredPrompt(null);
        return;
      } catch {
        /* fall through to hint */
      }
    }
    setPcHint(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPcHint(false);
          setOpen(true);
        }}
        title="Install Stream Freak on Android or PC"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold transition cursor-pointer shrink-0"
      >
        <MonitorDown className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Get App</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install Stream Freak"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0e1118] border border-white/15 p-5 sm:p-6 shadow-2xl text-white flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Install Stream Freak</h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Choose your device to get the best streaming experience
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Android Phone & TV APK */}
            <div className="rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Android Phone &amp; Android TV</p>
                  <p className="text-[11px] text-white/55">
                    Native APK • Built-in ad-blocker, push alerts &amp; auto-updates
                  </p>
                </div>
              </div>
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                <Download className="w-4 h-4" />
                Download StreamFreak.apk
              </a>
            </div>

            {/* Option 2: PC / Laptop / iPhone Web App */}
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">PC, Mac &amp; iPhone (Web App)</p>
                  <p className="text-[11px] text-white/55">
                    Instant lightweight desktop &amp; home-screen app
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePcInstall}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold transition cursor-pointer"
              >
                <MonitorDown className="w-4 h-4" />
                {deferredPrompt ? "Install on This PC / Device" : "How to Install on PC / iPhone"}
              </button>

              {pcHint && (
                <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 text-[11px] text-white/75 space-y-1.5 leading-relaxed">
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Windows / Mac (Chrome or Edge):</strong> Click the install icon on the right side of the address bar (or Menu → Install Stream Freak).
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">iPhone / iPad (Safari):</strong> Tap the Share button → <strong>Add to Home Screen</strong>.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
