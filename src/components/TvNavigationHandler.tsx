"use client";

import { useEffect } from "react";
import { isTvDevice } from "@/lib/device";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]';

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/**
 * Enables D-Pad spatial navigation (ArrowUp/Down/Left/Right) for Android TV
 * remotes and keyboard navigation across all interactive elements.
 */
export default function TvNavigationHandler() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (
        key !== "ArrowUp" &&
        key !== "ArrowDown" &&
        key !== "ArrowLeft" &&
        key !== "ArrowRight"
      ) {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const inDialog = Boolean(active?.closest('[role="dialog"]'));

      // On PCs/laptops, preserve normal arrow-key page scrolling & video seeking outside modals;
      // on Android TV devices, enable full D-Pad spatial navigation everywhere.
      if (!isTvDevice() && !inDialog) {
        return;
      }

      const tag = active?.tagName;

      // Allow Left/Right cursor movement inside text inputs & textareas
      if (
        (tag === "INPUT" || tag === "TEXTAREA") &&
        (key === "ArrowLeft" || key === "ArrowRight")
      ) {
        return;
      }
      if (tag === "SELECT") return;

      const candidates = getFocusableElements();
      if (candidates.length === 0) return;

      if (!active || active === document.body || !isVisible(active)) {
        e.preventDefault();
        candidates[0].focus();
        candidates[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }

      const cur = active.getBoundingClientRect();
      const cx = cur.left + cur.width / 2;
      const cy = cur.top + cur.height / 2;

      let best: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const el of candidates) {
        if (el === active) continue;
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        const dx = ex - cx;
        const dy = ey - cy;

        let primary = 0;
        let secondary = 0;

        if (key === "ArrowRight") {
          if (dx <= 4) continue;
          primary = dx;
          secondary = Math.abs(dy);
        } else if (key === "ArrowLeft") {
          if (dx >= -4) continue;
          primary = -dx;
          secondary = Math.abs(dy);
        } else if (key === "ArrowDown") {
          if (dy <= 4) continue;
          primary = dy;
          secondary = Math.abs(dx);
        } else if (key === "ArrowUp") {
          if (dy >= -4) continue;
          primary = -dy;
          secondary = Math.abs(dx);
        }

        // Strongly prefer elements aligned along the movement axis
        const score = primary + secondary * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }

      if (best) {
        e.preventDefault();
        best.focus({ preventScroll: true });
        best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return null;
}
