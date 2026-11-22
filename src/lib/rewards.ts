import { supabase } from "@/lib/supabase";

export type BadgeId =
  | "first_watch"
  | "binge_5"
  | "binge_20"
  | "anime_fan"
  | "night_owl"
  | "streak_3"
  | "streak_7"
  | "party_host"
  | "vip"
  | "founder"
  | "beta";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  tier: "emerald" | "sky" | "amber" | "violet" | "rose";
  exclusive?: boolean;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: "first_watch",
    name: "First Screening",
    description: "Played your first title on Stream Freak",
    tier: "emerald",
  },
  {
    id: "binge_5",
    name: "Binge Runner",
    description: "Watched 5 movies or episodes",
    tier: "sky",
  },
  {
    id: "binge_20",
    name: "Marathon Master",
    description: "Watched 20 movies or episodes",
    tier: "violet",
  },
  {
    id: "anime_fan",
    name: "Otaku Initiate",
    description: "Streamed 5 anime titles or episodes",
    tier: "rose",
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Watched between midnight and 4 AM",
    tier: "violet",
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "Streamed 3 days in a row",
    tier: "amber",
  },
  {
    id: "streak_7",
    name: "7-Day Streak",
    description: "Streamed 7 days in a row",
    tier: "amber",
  },
  {
    id: "party_host",
    name: "Cinema Host",
    description: "Hosted a live Watch Party",
    tier: "emerald",
  },
  {
    id: "vip",
    name: "VIP Member",
    description: "Exclusive badge granted by Stream Freak",
    tier: "amber",
    exclusive: true,
  },
  {
    id: "founder",
    name: "OG Founder",
    description: "Day-one Stream Freak insider",
    tier: "violet",
    exclusive: true,
  },
  {
    id: "beta",
    name: "Early Supporter",
    description: "Helped shape Stream Freak",
    tier: "sky",
    exclusive: true,
  },
];

export interface UserRewards {
  xp: number;
  streak: number;
  lastActiveDate: string | null;
  watchCount: number;
  animeCount: number;
  partyHosted: number;
  badges: BadgeId[];
  specialBadges: BadgeId[];
}

export const DEFAULT_REWARDS: UserRewards = {
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  watchCount: 0,
  animeCount: 0,
  partyHosted: 0,
  badges: [],
  specialBadges: [],
};

const LEVELS = [
  { level: 1, title: "Rookie", minXp: 0 },
  { level: 2, title: "Cinephile", minXp: 100 },
  { level: 3, title: "Otaku", minXp: 275 },
  { level: 4, title: "Binge Master", minXp: 550 },
  { level: 5, title: "Stream Freak", minXp: 950 },
  { level: 6, title: "Cinema Legend", minXp: 1500 },
];

export function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1] ?? null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }
  const progress = next
    ? Math.min(100, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;
  return {
    level: current.level,
    title: current.title,
    xp,
    nextXp: next ? next.minXp : null,
    progress,
  };
}

function storageKey(uid: string | null): string {
  return uid ? `sf_rewards_${uid}` : "sf_rewards_guest";
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayIsoDate(): string {
  const d = new Date(Date.now() - 86400 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadLocalRewards(uid: string | null): UserRewards {
  if (typeof window === "undefined") return DEFAULT_REWARDS;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return DEFAULT_REWARDS;
    const parsed = JSON.parse(raw) as Partial<UserRewards>;
    return {
      ...DEFAULT_REWARDS,
      ...parsed,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      specialBadges: Array.isArray(parsed.specialBadges) ? parsed.specialBadges : [],
    };
  } catch {
    return DEFAULT_REWARDS;
  }
}

export function saveLocalRewards(uid: string | null, rewards: UserRewards) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(rewards));
    window.dispatchEvent(new CustomEvent("sf:rewards-updated", { detail: rewards }));
  } catch {
    /* ignore */
  }
}

function computeUnlockedBadges(r: UserRewards): BadgeId[] {
  const set = new Set<BadgeId>(r.badges);
  if (r.watchCount >= 1) set.add("first_watch");
  if (r.watchCount >= 5) set.add("binge_5");
  if (r.watchCount >= 20) set.add("binge_20");
  if (r.animeCount >= 5) set.add("anime_fan");
  if (r.streak >= 3) set.add("streak_3");
  if (r.streak >= 7) set.add("streak_7");
  if (r.partyHosted >= 1) set.add("party_host");
  const hour = new Date().getHours();
  if (r.watchCount >= 1 && hour >= 0 && hour < 4) set.add("night_owl");
  return Array.from(set);
}

export async function syncRewardsFromCloud(uid: string): Promise<UserRewards> {
  const local = loadLocalRewards(uid);
  try {
    const { data, error } = await supabase
      .from("user_rewards")
      .select("xp,streak,last_active_date,watch_count,anime_count,party_hosted,badges,special_badges")
      .eq("user_id", uid)
      .maybeSingle();

    if (error || !data) return local;

    const merged: UserRewards = {
      xp: Math.max(local.xp, data.xp ?? 0),
      streak: Math.max(local.streak, data.streak ?? 0),
      lastActiveDate: data.last_active_date || local.lastActiveDate,
      watchCount: Math.max(local.watchCount, data.watch_count ?? 0),
      animeCount: Math.max(local.animeCount, data.anime_count ?? 0),
      partyHosted: Math.max(local.partyHosted, data.party_hosted ?? 0),
      badges: Array.from(new Set([...(data.badges ?? []), ...local.badges])) as BadgeId[],
      specialBadges: Array.isArray(data.special_badges) ? (data.special_badges as BadgeId[]) : local.specialBadges,
    };
    merged.badges = computeUnlockedBadges(merged);
    saveLocalRewards(uid, merged);
    return merged;
  } catch {
    return local;
  }
}

async function pushRewardsToCloud(uid: string, rewards: UserRewards) {
  try {
    await supabase.from("user_rewards").upsert(
      {
        user_id: uid,
        xp: rewards.xp,
        streak: rewards.streak,
        last_active_date: rewards.lastActiveDate,
        watch_count: rewards.watchCount,
        anime_count: rewards.animeCount,
        party_hosted: rewards.partyHosted,
        badges: rewards.badges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    /* table optional */
  }
}

export interface XpToastEvent {
  xpGained: number;
  reason: string;
  streak: number;
  leveledUp: boolean;
  levelTitle?: string;
  level?: number;
  newBadges: string[];
}

function emitXpToast(detail: XpToastEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<XpToastEvent>("sf:xp-earned", { detail }));
}

export function recordWatchReward(uid: string | null, isAnime: boolean): UserRewards {
  const cur = loadLocalRewards(uid);
  const prevLvl = getLevelInfo(cur.xp).level;
  const prevBadges = new Set<BadgeId>(cur.badges);
  const today = todayIsoDate();
  const yesterday = yesterdayIsoDate();

  let streak = cur.streak;
  let bonusXp = 0;
  if (cur.lastActiveDate !== today) {
    streak = cur.lastActiveDate === yesterday ? cur.streak + 1 : 1;
    bonusXp = 15;
  }

  const xpGained = 25 + bonusXp;
  const next: UserRewards = {
    ...cur,
    xp: cur.xp + xpGained,
    streak,
    lastActiveDate: today,
    watchCount: cur.watchCount + 1,
    animeCount: cur.animeCount + (isAnime ? 1 : 0),
  };
  next.badges = computeUnlockedBadges(next);
  saveLocalRewards(uid, next);
  if (uid) void pushRewardsToCloud(uid, next);

  const nextLvl = getLevelInfo(next.xp);
  const newBadges = next.badges
    .filter((b) => !prevBadges.has(b))
    .map((id) => BADGE_CATALOG.find((c) => c.id === id)?.name || id);

  emitXpToast({
    xpGained,
    reason: bonusXp > 0 ? "Daily Streak Bonus" : isAnime ? "Anime Episode" : "Now Streaming",
    streak: next.streak,
    leveledUp: nextLvl.level > prevLvl,
    level: nextLvl.level,
    levelTitle: nextLvl.title,
    newBadges,
  });

  return next;
}

export function recordPartyReward(uid: string | null, isHost: boolean): UserRewards {
  const cur = loadLocalRewards(uid);
  const prevLvl = getLevelInfo(cur.xp).level;
  const prevBadges = new Set<BadgeId>(cur.badges);
  const xpGained = isHost ? 30 : 15;

  const next: UserRewards = {
    ...cur,
    xp: cur.xp + xpGained,
    partyHosted: cur.partyHosted + (isHost ? 1 : 0),
  };
  next.badges = computeUnlockedBadges(next);
  saveLocalRewards(uid, next);
  if (uid) void pushRewardsToCloud(uid, next);

  const nextLvl = getLevelInfo(next.xp);
  const newBadges = next.badges
    .filter((b) => !prevBadges.has(b))
    .map((id) => BADGE_CATALOG.find((c) => c.id === id)?.name || id);

  emitXpToast({
    xpGained,
    reason: isHost ? "Watch Party Host" : "Joined Watch Party",
    streak: next.streak,
    leveledUp: nextLvl.level > prevLvl,
    level: nextLvl.level,
    levelTitle: nextLvl.title,
    newBadges,
  });

  return next;
}
