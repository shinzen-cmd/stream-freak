import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  PushTarget,
  sendFcmPush,
  verifyAdminCaller,
} from "@/lib/fcmServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AutoNotifySettings {
  id: number;
  enabled: boolean;
  max_per_day: number;
  target_platform: PushTarget;
}

interface CandidateDrop {
  key: string;
  category: "movie" | "tv" | "anime" | "bollywood";
  title: string;
  message: string;
  imageUrl: string | null;
  url: string;
}

const DEFAULT_SETTINGS: AutoNotifySettings = {
  id: 1,
  enabled: false,
  max_per_day: 4,
  target_platform: "all",
};

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function authorizeCronOrAdmin(req: NextRequest): Promise<{ ok: boolean; isAdmin: boolean }> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const querySecret = req.nextUrl.searchParams.get("secret") || "";

  if (cronSecret && (bearer === cronSecret || querySecret === cronSecret)) {
    return { ok: true, isAdmin: false };
  }

  const adminAuth = await verifyAdminCaller(req);
  if (adminAuth.ok) {
    return { ok: true, isAdmin: true };
  }
  return { ok: false, isAdmin: false };
}

async function fetchTrendingCandidates(): Promise<CandidateDrop[]> {
  const results: CandidateDrop[] = [];

  // 1. Trending Movies (TMDB)
  if (TMDB_KEY) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}&language=en-US`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          results?: Array<{
            id: number;
            title?: string;
            overview?: string;
            backdrop_path?: string;
            poster_path?: string;
            vote_average?: number;
          }>;
        };
        for (const item of (json.results ?? []).slice(0, 10)) {
          if (!item.id || !item.title) continue;
          const img = item.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
            : item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null;
          const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)} • ` : "";
          results.push({
            key: `movie:${item.id}`,
            category: "movie",
            title: `Trending Movie: ${item.title}`,
            message: `${rating}${(item.overview || "Now streaming in HD on Stream Freak.").slice(0, 120)}`,
            imageUrl: img,
            url: `/watch?id=${item.id}&type=movie`,
          });
        }
      }
    } catch {
      /* ignore */
    }

    // 2. Trending TV Shows (TMDB)
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_KEY}&language=en-US`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          results?: Array<{
            id: number;
            name?: string;
            overview?: string;
            backdrop_path?: string;
            poster_path?: string;
            vote_average?: number;
          }>;
        };
        for (const item of (json.results ?? []).slice(0, 10)) {
          if (!item.id || !item.name) continue;
          const img = item.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
            : item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null;
          const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)} • ` : "";
          results.push({
            key: `tv:${item.id}`,
            category: "tv",
            title: `Hot Series: ${item.name}`,
            message: `${rating}${(item.overview || "Binge episodes now in HD on Stream Freak.").slice(0, 120)}`,
            imageUrl: img,
            url: `/watch?id=${item.id}&type=tv`,
          });
        }
      }
    } catch {
      /* ignore */
    }

    // 3. Popular Bollywood / Hindi Movies (TMDB)
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=hi&sort_by=popularity.desc&page=1`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          results?: Array<{
            id: number;
            title?: string;
            overview?: string;
            backdrop_path?: string;
            poster_path?: string;
          }>;
        };
        for (const item of (json.results ?? []).slice(0, 8)) {
          if (!item.id || !item.title) continue;
          const img = item.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
            : item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null;
          results.push({
            key: `bollywood:${item.id}`,
            category: "bollywood",
            title: `Bollywood Pick: ${item.title}`,
            message: (item.overview || "Stream now in HD on Stream Freak.").slice(0, 130),
            imageUrl: img,
            url: `/watch?id=${item.id}&type=movie`,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 4. Trending Anime (AniList GraphQL — no API key needed)
  try {
    const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { id title { english romaji } description bannerImage coverImage { extraLarge } averageScore } } }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: {
          Page?: {
            media?: Array<{
              id: number;
              title?: { english?: string; romaji?: string };
              description?: string;
              bannerImage?: string;
              coverImage?: { extraLarge?: string };
              averageScore?: number;
            }>;
          };
        };
      };
      for (const a of json.data?.Page?.media ?? []) {
        const name = a.title?.english || a.title?.romaji;
        if (!a.id || !name) continue;
        const cleanDesc = (a.description || "Watch subbed & dubbed episodes on Stream Freak.")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const score = a.averageScore ? `${a.averageScore}% Rated • ` : "";
        results.push({
          key: `anime:${a.id}`,
          category: "anime",
          title: `Trending Anime: ${name}`,
          message: `${score}${cleanDesc.slice(0, 120)}`,
          imageUrl: a.bannerImage || a.coverImage?.extraLarge || null,
          url: `/watch?id=${a.id}&type=anime&anilistId=${a.id}`,
        });
      }
    }
  } catch {
    /* ignore */
  }

  return results;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      sentToday: 0,
      tableReady: false,
    });
  }

  const { data: settingsRow, error: sErr } = await supa
    .from("auto_notify_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: sentToday, error: lErr } = await supa
    .from("auto_notify_log")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", startOfDay.toISOString());

  return NextResponse.json({
    settings: (settingsRow as AutoNotifySettings) ?? DEFAULT_SETTINGS,
    sentToday: sentToday ?? 0,
    tableReady: !sErr && !lErr,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  let body: Partial<AutoNotifySettings> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const maxPerDay = Math.min(8, Math.max(1, Number(body.max_per_day ?? 4) || 4));
  const target: PushTarget =
    body.target_platform === "android" || body.target_platform === "web"
      ? body.target_platform
      : "all";

  const nextSettings: AutoNotifySettings = {
    id: 1,
    enabled: Boolean(body.enabled),
    max_per_day: maxPerDay,
    target_platform: target,
  };

  const { error } = await supa
    .from("auto_notify_settings")
    .upsert(nextSettings, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: nextSettings });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = Boolean(body?.force && auth.isAdmin);
  } catch {
    /* empty body is fine for cron */
  }

  const { data: settingsRow } = await supa
    .from("auto_notify_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings: AutoNotifySettings = (settingsRow as AutoNotifySettings) ?? DEFAULT_SETTINGS;

  if (!force && !settings.enabled) {
    return NextResponse.json({ skipped: true, reason: "Auto-Notify is paused in Admin Dashboard." });
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: sentTodayCount } = await supa
    .from("auto_notify_log")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", startOfDay.toISOString());

  const sentToday = sentTodayCount ?? 0;
  if (!force && sentToday >= settings.max_per_day) {
    return NextResponse.json({
      skipped: true,
      reason: `Daily limit reached (${sentToday}/${settings.max_per_day}).`,
    });
  }

  // Avoid repeating any title sent in the last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
  const { data: recentLogs } = await supa
    .from("auto_notify_log")
    .select("item_key")
    .gte("sent_at", fourteenDaysAgo);

  const recentKeys = new Set((recentLogs ?? []).map((r) => String(r.item_key)));

  const candidates = await fetchTrendingCandidates();
  const fresh = candidates.filter((c) => !recentKeys.has(c.key));
  const pool = fresh.length > 0 ? fresh : candidates;

  if (pool.length === 0) {
    return NextResponse.json({ error: "No trending titles could be fetched right now." }, { status: 502 });
  }

  // Rotate category based on how many drops were sent today
  const rotation: Array<CandidateDrop["category"]> = ["movie", "tv", "anime", "bollywood"];
  const preferredCategory = rotation[sentToday % rotation.length];
  const preferredPool = pool.filter((c) => c.category === preferredCategory);
  const pickPool = preferredPool.length > 0 ? preferredPool : pool;
  const chosen = pickPool[Math.floor(Math.random() * Math.min(pickPool.length, 4))];

  const pushRes = await sendFcmPush({
    title: chosen.title,
    message: chosen.message,
    imageUrl: chosen.imageUrl,
    url: chosen.url,
    target: settings.target_platform,
  });

  if (!pushRes.ok) {
    return NextResponse.json({ error: pushRes.error }, { status: pushRes.status });
  }

  await supa.from("auto_notify_log").insert({
    item_key: chosen.key,
    title: chosen.title,
    category: chosen.category,
    sent_count: pushRes.sent,
  });

  return NextResponse.json({
    ok: true,
    drop: {
      title: chosen.title,
      category: chosen.category,
      url: chosen.url,
    },
    sent: pushRes.sent,
    total: pushRes.total,
    sentToday: sentToday + 1,
    maxPerDay: settings.max_per_day,
  });
}
