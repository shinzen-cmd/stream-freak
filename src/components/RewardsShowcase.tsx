"use client";

import React, { useEffect, useState } from "react";
import {
  Award,
  Crown,
  Flame,
  Film,
  Lock,
  Moon,
  Radio,
  Star,
  Trophy,
  Tv,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  BADGE_CATALOG,
  BadgeId,
  DEFAULT_REWARDS,
  UserRewards,
  getLevelInfo,
  loadLocalRewards,
  syncRewardsFromCloud,
} from "@/lib/rewards";

const BADGE_ICONS: Record<BadgeId, React.ElementType> = {
  first_watch: Film,
  binge_5: Tv,
  binge_20: Trophy,
  anime_fan: Zap,
  night_owl: Moon,
  streak_3: Flame,
  streak_7: Flame,
  party_host: Radio,
  vip: Crown,
  founder: Star,
  beta: Award,
};

const TIER_STYLES = {
  emerald: "bg-emerald-500/15 border-emerald-500/35 text-emerald-300",
  sky: "bg-sky-500/15 border-sky-500/35 text-sky-300",
  amber: "bg-amber-500/15 border-amber-500/35 text-amber-300",
  violet: "bg-violet-500/15 border-violet-500/35 text-violet-300",
  rose: "bg-rose-500/15 border-rose-500/35 text-rose-300",
};

export default function RewardsShowcase() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<UserRewards>(DEFAULT_REWARDS);

  useEffect(() => {
    const uid = user?.uid ?? null;
    setRewards(loadLocalRewards(uid));
    if (uid) {
      void syncRewardsFromCloud(uid).then(setRewards);
    }

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<UserRewards>).detail;
      if (detail) setRewards(detail);
    };
    window.addEventListener("sf:rewards-updated", onUpdate);
    return () => window.removeEventListener("sf:rewards-updated", onUpdate);
  }, [user?.uid]);

  const lvl = getLevelInfo(rewards.xp);
  const unlockedSet = new Set<BadgeId>([...rewards.badges, ...rewards.specialBadges]);
  const visibleCatalog = BADGE_CATALOG.filter((b) => !b.exclusive || unlockedSet.has(b.id));

  return (
    <section className="mb-10 rounded-2xl bg-[#0e1118] border border-white/10 p-5 sm:p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Level {lvl.level}
              </span>
              <span className="text-white/25">•</span>
              <span className="text-sm font-black text-white">{lvl.title}</span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              {rewards.xp} XP earned
              {lvl.nextXp ? ` · ${lvl.nextXp - rewards.xp} XP to Level ${lvl.level + 1}` : " · Max Rank Reached"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-400" />
            {rewards.streak} Day Streak
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/75 text-xs font-semibold">
            <Award className="w-4 h-4 text-emerald-400" />
            {unlockedSet.size} Badges
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mt-4 mb-5">
        <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
            style={{ width: `${Math.max(4, lvl.progress)}%` }}
          />
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {visibleCatalog.map((b) => {
          const unlocked = unlockedSet.has(b.id);
          const Icon = BADGE_ICONS[b.id];
          return (
            <div
              key={b.id}
              className={`rounded-xl p-3 border transition flex items-start gap-2.5 ${
                unlocked
                  ? TIER_STYLES[b.tier]
                  : "bg-white/[0.02] border-white/[0.06] text-white/35"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  unlocked ? "bg-black/25" : "bg-white/[0.04]"
                }`}
              >
                {unlocked ? <Icon className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-white/30" />}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${unlocked ? "text-white" : "text-white/45"}`}>
                  {b.name}
                </p>
                <p className="text-[10px] leading-snug opacity-75 line-clamp-2 mt-0.5">
                  {b.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
