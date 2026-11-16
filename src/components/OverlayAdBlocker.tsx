"use client";

import React, { useEffect, useRef } from "react";

interface OverlayAdBlockerProps {
  embedUrl: string;
  title?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * OverlayAdBlocker Component
 * Wraps an unsandboxed iframe with focus-regain and popup suppression
 * to neutralize popup hijacks without requiring extra user clicks.
 */
export default function OverlayAdBlocker({
  embedUrl,
  title = "Embedded Stream Player",
  className = "",
  onLoad,
  onError,
}: OverlayAdBlockerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Focus blur monitor: automatically regain focus if iframe attempts a popunder redirect
  useEffect(() => {
    if (typeof window === "undefined") return;

    let refocusTimer: NodeJS.Timeout | null = null;

    const handleWindowBlur = () => {
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
    window.open = function (url?: string | URL) {
      console.warn("[OverlayAdBlocker] Blocked top-level popup attempt:", url);
      return null;
    };

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      if (refocusTimer) clearTimeout(refocusTimer);
      window.open = originalOpen;
    };
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black ${className}`}>
      {/* Unsandboxed Iframe: avoids anti-sandbox checks */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full border-0 z-10"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
        referrerPolicy="origin"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}
