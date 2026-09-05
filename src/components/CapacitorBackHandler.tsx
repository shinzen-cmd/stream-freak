"use client";

/**
 * CapacitorBackHandler
 *
 * Handles Android hardware back button behavior and automatic screen orientation:
 * - Portrait lock for all browsing screens
 * - Landscape unlock when video player is active (fullscreen)
 * - Back button: navigates history; exits app only from root "/"
 *
 * Mount this component once inside the root layout (client-side only).
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function CapacitorBackHandler({
  isPlayerOpen = false,
}: {
  isPlayerOpen?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // --- Back Button ---
  useEffect(() => {
    let App: any = null;
    let backListener: any = null;

    const setup = async () => {
      try {
        const cap = await import("@capacitor/core");
        if (!cap.Capacitor.isNativePlatform()) return;

        const { App: CapApp } = await import("@capacitor/app");
        App = CapApp;

        backListener = await CapApp.addListener("backButton", ({ canGoBack }) => {
          // If we're on the root home screen, exit the app
          if (pathname === "/" && !canGoBack) {
            CapApp.exitApp();
            return;
          }
          // Otherwise navigate back
          router.back();
        });
      } catch (err) {
        // Not running in Capacitor — ignore gracefully
      }
    };

    setup();

    return () => {
      backListener?.remove?.();
    };
  }, [pathname, router]);

  // --- Screen Orientation & Auto-Landscape on Fullscreen ---
  useEffect(() => {
    let orientationPlugin: any = null;

    const handleFullscreenOrientation = async () => {
      const isFullscreen = !!document.fullscreenElement;
      
      // 1. If running inside Capacitor mobile app
      try {
        const cap = await import("@capacitor/core");
        if (cap.Capacitor.isNativePlatform()) {
          const { ScreenOrientation } = await import("@capacitor/screen-orientation");
          orientationPlugin = ScreenOrientation;
          if (isFullscreen) {
            await ScreenOrientation.lock({ orientation: "landscape" });
          } else {
            await ScreenOrientation.lock({ orientation: "portrait" });
          }
          return;
        }
      } catch {
        // Continue to Web ScreenOrientation API
      }

      // 2. If running in mobile browser (Chrome Android / Safari / Firefox)
      if (typeof window !== "undefined" && window.screen && "orientation" in window.screen) {
        const screenOri = (window.screen as any).orientation;
        if (screenOri && typeof screenOri.lock === "function") {
          try {
            if (isFullscreen) {
              await screenOri.lock("landscape");
            } else if (typeof screenOri.unlock === "function") {
              screenOri.unlock();
            }
          } catch {
            // Orientation lock may require user interaction or not supported on iOS Safari
          }
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenOrientation);
    document.addEventListener("webkitfullscreenchange", handleFullscreenOrientation);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenOrientation);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenOrientation);
    };
  }, []);

  return null;
}
