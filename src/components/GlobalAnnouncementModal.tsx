"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppNotification, fetchActiveNotifications } from "@/lib/notifications";
import NotificationPopupCard from "@/components/NotificationPopupCard";

const DISMISSED_KEY = "sf_dismissed_notifs";

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function markDismissed(id: string) {
  try {
    const ids = getDismissedIds();
    ids.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export default function GlobalAnnouncementModal() {
  const router = useRouter();
  const [queue, setQueue] = useState<AppNotification[]>([]);

  useEffect(() => {
    let active = true;
    fetchActiveNotifications()
      .then((list) => {
        if (!active || !list.length) return;
        const dismissed = getDismissedIds();
        const visible = list.filter((n) => !n.show_once || !dismissed.has(n.id));
        setQueue(visible);
      })
      .catch(() => {
        /* ignore network errors */
      });
    return () => {
      active = false;
    };
  }, []);

  const current = queue[0] ?? null;

  const handleDismiss = useCallback(() => {
    if (!current) return;
    if (current.show_once) {
      markDismissed(current.id);
    }
    setQueue((prev) => prev.slice(1));
  }, [current]);

  const handleAction = useCallback(() => {
    if (!current?.cta_url) return;
    const url = current.cta_url.trim();
    if (current.show_once) {
      markDismissed(current.id);
    }
    setQueue((prev) => prev.slice(1));

    if (/^https?:\/\//i.test(url)) {
      import("@capacitor/browser")
        .then(({ Browser }) => Browser.open({ url }))
        .catch(() => {
          window.open(url, "_blank", "noopener,noreferrer");
        });
    } else {
      router.push(url);
    }
  }, [current, router]);

  useEffect(() => {
    if (!current?.dismissible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, handleDismiss]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={current.dismissible ? handleDismiss : undefined}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <NotificationPopupCard
          title={current.title}
          message={current.message}
          tone={current.tone}
          badge={current.badge}
          imageUrl={current.image_url}
          ctaLabel={current.cta_label}
          ctaUrl={current.cta_url}
          dismissible={current.dismissible}
          onDismiss={handleDismiss}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}
