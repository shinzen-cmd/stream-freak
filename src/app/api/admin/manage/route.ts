import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, verifyAdminCaller } from "@/lib/fcmServer";
import { DEFAULT_SITE_CONFIG } from "@/lib/siteConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY in Vercel." },
      { status: 503 }
    );
  }

  const [profilesRes, rewardsRes, requestsRes, configRes, userDataRes] = await Promise.all([
    supa.from("profiles").select("id,email,role,banned,created_at").order("created_at", { ascending: false }).limit(200),
    supa.from("user_rewards").select("user_id,xp,streak,watch_count,special_badges"),
    supa.from("user_requests").select("*").order("created_at", { ascending: false }).limit(100),
    supa.from("site_config").select("*").eq("id", 1).maybeSingle(),
    supa.from("user_data").select("user_id,watchlist,history").limit(200),
  ]);

  // Fallback if `banned` column doesn't exist yet on profiles
  let profileRows = profilesRes.data;
  if (profilesRes.error && /banned/i.test(profilesRes.error.message)) {
    const fallback = await supa
      .from("profiles")
      .select("id,email,role,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    profileRows = (fallback.data ?? []).map((p) => ({ ...p, banned: false }));
  }

  const rewardMap = new Map<string, { xp: number; streak: number; watch_count: number; special_badges: string[] }>();
  for (const r of rewardsRes.data ?? []) {
    rewardMap.set(String(r.user_id), {
      xp: r.xp ?? 0,
      streak: r.streak ?? 0,
      watch_count: r.watch_count ?? 0,
      special_badges: Array.isArray(r.special_badges) ? r.special_badges : [],
    });
  }

  // Aggregate top watched titles across all users
  const titleCounts = new Map<string, { title: string; type: string; count: number }>();
  const userWatchlistCount = new Map<string, number>();
  for (const ud of userDataRes.data ?? []) {
    const wl = Array.isArray(ud.watchlist) ? ud.watchlist : [];
    const hi = Array.isArray(ud.history) ? ud.history : [];
    userWatchlistCount.set(String(ud.user_id), wl.length);
    for (const item of hi) {
      const t = (item as { title?: string; name?: string; type?: string })?.title ||
        (item as { name?: string })?.name;
      if (!t) continue;
      const key = t.toLowerCase();
      const prev = titleCounts.get(key);
      titleCounts.set(key, {
        title: t,
        type: (item as { type?: string })?.type || "movie",
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  const topWatched = Array.from(titleCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const users = (profileRows ?? []).map((p) => {
    const rw = rewardMap.get(String(p.id));
    return {
      id: p.id,
      email: p.email || "(no email)",
      role: p.role || "user",
      banned: Boolean((p as { banned?: boolean }).banned),
      created_at: p.created_at,
      xp: rw?.xp ?? 0,
      streak: rw?.streak ?? 0,
      watch_count: rw?.watch_count ?? 0,
      watchlist_count: userWatchlistCount.get(String(p.id)) ?? 0,
      special_badges: rw?.special_badges ?? [],
    };
  });

  return NextResponse.json({
    users,
    requests: requestsRes.data ?? [],
    requestsReady: !requestsRes.error,
    config: configRes.data
      ? { ...DEFAULT_SITE_CONFIG, ...configRes.data }
      : DEFAULT_SITE_CONFIG,
    configReady: !configRes.error,
    topWatched,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = String(body.action || "");

  if (action === "toggle_role") {
    const userId = String(body.userId || "");
    const role = body.role === "admin" ? "admin" : "user";
    const { error } = await supa.from("profiles").update({ role }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_ban") {
    const userId = String(body.userId || "");
    const banned = Boolean(body.banned);
    const { error } = await supa.from("profiles").update({ banned }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "grant_badge") {
    const userId = String(body.userId || "");
    const badge = String(body.badge || "");
    if (!["vip", "founder", "beta"].includes(badge)) {
      return NextResponse.json({ error: "Invalid exclusive badge." }, { status: 400 });
    }
    const { data: existing } = await supa
      .from("user_rewards")
      .select("special_badges")
      .eq("user_id", userId)
      .maybeSingle();

    const current = Array.isArray(existing?.special_badges)
      ? (existing.special_badges as string[])
      : [];
    const has = current.includes(badge);
    const next = has ? current.filter((b) => b !== badge) : [...current, badge];

    const { error } = await supa
      .from("user_rewards")
      .upsert(
        { user_id: userId, special_badges: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, special_badges: next });
  }

  if (action === "save_config") {
    const cfg = (body.config ?? {}) as Record<string, unknown>;
    const payload = {
      id: 1,
      maintenance_mode: Boolean(cfg.maintenance_mode),
      maintenance_message:
        String(cfg.maintenance_message || "").trim() || DEFAULT_SITE_CONFIG.maintenance_message,
      watch_party_enabled: cfg.watch_party_enabled !== false,
      downloads_enabled: cfg.downloads_enabled !== false,
      guest_mode_enabled: cfg.guest_mode_enabled !== false,
      signups_enabled: cfg.signups_enabled !== false,
      disabled_servers: Array.isArray(cfg.disabled_servers)
        ? cfg.disabled_servers.map(String)
        : [],
    };
    const { error } = await supa.from("site_config").upsert(payload, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: payload });
  }

  if (action === "resolve_request") {
    const id = String(body.id || "");
    const status = body.status === "done" ? "done" : "open";
    const { error } = await supa.from("user_requests").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_request") {
    const id = String(body.id || "");
    const { error } = await supa.from("user_requests").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
}
