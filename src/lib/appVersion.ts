/**
 * Current installed app version (keep in sync with android/app/build.gradle versionName).
 * Bump this before building a new APK release so Force Update notifications
 * automatically stop showing once a user installs the new version.
 */
export const APP_VERSION = "1.0.0";

/**
 * Extracts a semantic version like "1.1.0" or "2.0" from a notification badge/title
 * (e.g. "UPDATE v1.1.0", "REQUIRED 1.2.0").
 */
export function extractRequiredVersion(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\bv?(\d+\.\d+(?:\.\d+)?)\b/i);
  return match ? match[1] : null;
}

/**
 * Returns true if `current` is strictly older than `required` (e.g. 1.0.0 < 1.1.0).
 */
export function isVersionOutdated(current: string, required: string): boolean {
  const curParts = current.split(".").map((n) => parseInt(n, 10) || 0);
  const reqParts = required.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(curParts.length, reqParts.length);
  for (let i = 0; i < len; i++) {
    const c = curParts[i] ?? 0;
    const r = reqParts[i] ?? 0;
    if (c < r) return true;
    if (c > r) return false;
  }
  return false;
}
