import { Capacitor } from "@capacitor/core";

export const PRODUCTION_WEB_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://streamfreak.vercel.app"
).replace(/\/+$/, "");

/**
 * Resolves a backend API path:
 * - On Web / Vercel: uses relative "/api/..."
 * - Inside Capacitor Android APK: routes to the live Vercel backend (https://streamfreak.vercel.app)
 *   so Admin Push Notifications and Hyperbeam Watch Party work natively inside the app.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (Capacitor.isNativePlatform()) {
    return `${PRODUCTION_WEB_ORIGIN}${normalized}`;
  }
  return normalized;
}

/**
 * Returns a public shareable origin (avoids sharing "https://localhost" from inside the APK).
 */
export function shareOrigin(): string {
  if (Capacitor.isNativePlatform() || typeof window === "undefined") {
    return PRODUCTION_WEB_ORIGIN;
  }
  return window.location.origin;
}
