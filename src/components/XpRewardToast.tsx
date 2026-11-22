"use client";

import React, { useEffect, useRef, useState } from "react";
import { Award, Flame, Trophy, Zap } from "lucide-react";
import type { XpToastEvent } from "@/lib/rewards";

export default function XpRewardToast() {
  const [item, setItem] = useState<XpToastEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onXp = (e: Event) => {
      const detail = (e as CustomEvent<XpToastEvent>).detail;
      if (!detail || !detail.xpGained) return;

      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);

      setItem(detail);
      setVisible(true);

      const duration = detail.leveledUp || detail.newBadges.length > 0 ? 3400 : 2200;
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        clearTimerRef.current = window.setTimeout(() => setItem(null), 350);
      }, duration);
    };

    window.addEventListener("sf:xp-earned", onXp);
    return () => {
      window.removeEventListener("sf:xp-earned", onXp);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  if (!item) return null;

  const isSpecial = item.leveledUp || item.newBadges.length > 0;

  return (
    <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+4.5rem)] left-1/2 -translate-x-1/2 z-[85] px-3 w-full max-w-xs flex justify-center">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-3 scale-95"
        } ${
          isSpecial
            ? "bg-[#121622]/95 border-amber-400/45 shadow-amber-500/20"
            : "bg-[#0e141c]/95 border-emerald-400/40 shadow-emerald-500/20"
        }`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 animate-bounce ${
            isSpecial
              ? "bg-amber-500/20 border border-amber-400/40 text-amber-300"
              : "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300"
          }`}
        >
          {item.leveledUp ? (
            <Trophy className="w-4 h-4" />
          ) : item.newBadges.length > 0 ? (
            <Award className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-emerald-300">
              +{item.xpGained} XP
            </span>
            {item.streak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-300">
                <Flame className="w-3 h-3" />
                {item.streak}d
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-white/80 truncate">
            {item.leveledUp
              ? `Level ${item.level} • ${item.levelTitle}!`
              : item.newBadges.length > 0
              ? `Badge Unlocked: ${item.newBadges[0]}`
              : item.reason}
          </p>
        </div>
      </div>
    </div>
  );
}
