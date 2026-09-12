"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, Play, ShieldAlert } from "lucide-react";

interface OverlayAdBlockerProps {
  embedUrl: string;
  title?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * OverlayAdBlocker Component
 * Wraps an unsandboxed iframe with a first-party click shield and focus-regain protection
 * to neutralize popup hijacks and popunders without triggering anti-sandbox script crashes.
 */
export default function OverlayAdBlocker({
  embedUrl,
  title = "Embedded Stream Player",
  className = "",
  onLoad,
  onError,
}: OverlayAdBlockerProps) {
  const [isShieldActive, setIsShieldActive] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Focus blur monitor: automatically regain focus if iframe attempts a popunder redirect
  useEffect(() => {
    if (typeof window === "undefined") return;

    let refocusTimer: NodeJS.Timeout | null = null;

    const handleWindowBlur = () => {
      // Immediate refocus to suppress popunder window creation
      refocusTimer = setTimeout(() => {
        try {
          window.focus();
        } catch {
          // Ignore focus security exceptions
        }
      }, 50);
    };

    window.addEventListener("blur", handleWindowBlur);

    // Suppress window.open popups initiated from top context
    const originalOpen = window.open;
    window.open = function (url?: string | URL, target?: string, features?: string) {
      console.warn("[OverlayAdBlocker] Blocked top-level popup attempt:", url);
      return null;
    };

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      if (refocusTimer) clearTimeout(refocusTimer);
      window.open = originalOpen;
    };
  }, []);

  // When embedUrl changes, re-arm the shield for the new server
  useEffect(() => {
    setIsShieldActive(true);
    setClickCount(0);
  }, [embedUrl]);

  const handleShieldClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setClickCount((c) => c + 1);

    // Intercept initial ad-triggering click and drop the shield to expose native controls
    setIsShieldActive(false);

    // Keep focus firmly on the host window
    if (typeof window !== "undefined") {
      window.focus();
    }
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black ${className}`}>
      {/* Unsandboxed Iframe: avoids anti-sandbox checks in Megavid, Zorotv, VidLink */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full border-0 z-10"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
        referrerPolicy="no-referrer"
        onLoad={onLoad}
        onError={onError}
      />

      {/* First-party Click Shield: absorbs popup hijacks on initial user interaction */}
      {isShieldActive && (
        <div
          onClick={handleShieldClick}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 hover:bg-black/20 backdrop-blur-[1px] transition-all cursor-pointer group select-none"
          title="Click to activate player and dismiss ad overlay"
          role="button"
          tabIndex={0}
          aria-label="Click to start video playback"
        >
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-black/70 border border-white/10 shadow-2xl backdrop-blur-md group-hover:scale-105 group-hover:border-emerald-500/40 transition-all">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Play className="w-7 h-7 ml-0.5 fill-current" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-xs sm:text-sm tracking-wide">
                Click to Start Video
              </p>
              <div className="flex items-center justify-center gap-1 mt-1 text-[11px] text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ad Shield Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
