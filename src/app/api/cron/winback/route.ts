import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, sendFcmToTokens, verifyAdminCaller } from "@/lib/fcmServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINBACK_MESSAGES = [
  {
    title: "Your Seat Is Waiting 🍿",
    message: "Fresh HD movies, series & new anime episodes dropped while you were away. Jump back in!",
    url: "/explore",
  },
  {
    title: "Ready for Movie Night?",
    message: "Trending releases just hit Stream Freak — tap to explore tonight's top picks.",
    url: "/movies",
  },
  {
    title: "New Anime Episodes Are Live",
    message: "Catch up on the latest subbed & dubbed anime drops and keep your watch streak alive!",
    url: "/anime",
  },
  {
    title: "Haven't Seen You in a Bit!",
    message: "Open Stream Freak to check out new Bollywood hits, top-rated shows, and live Watch Parties.",
    url: "/",
  },
];

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

async function authorizeCronOrAdmin(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const querySecret = req.nextUrl.searchParams.get("secret") || "";

  if (cronSecret && (bearer === cronSecret || querySecret === cronSecret)) {
    return true;
  }
  const admin = await verifyAdminCaller(req);
  return admin.ok;
}

async function getDormantTokens(days: number) {
  const supa = getSupabaseAdmin();
  if (!supa) return { tokens: [] as string[], error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const cooldownCutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  // Prefer checking last_winback_at cooldown if column exists, else fallback cleanly
  const { data, error } = await supa
    .from("push_tokens")
    .select("token,updated_at,last_winback_at")
    .lt("updated_at", cutoff);

  if (!error && data) {
    const eligible = data
      .filter((r) => !r.last_winback_at || String(r.last_winback_at) < cooldownCutoff)
      .map((r) => String(r.token));
    return { tokens: eligible, error: null, hasWinbackCol: true };
  }

  const fallback = await supa
    .from("push_tokens")
    .select("token,updated_at")
    .lt("updated_at", cutoff);

  if (fallback.error) {
    return { tokens: [], error: fallback.error.message, hasWinbackCol: false };
  }

  return {
    tokens: (fallback.data ?? []).map((r) => String(r.token)),
    error: null,
    hasWinbackCol: false,
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("days") || 3) || 3));
  const { tokens, error } = await getDormantTokens(days);
  return NextResponse.json({
    days,
    dormantCount: tokens.length,
    error,
  });
}

export async function POST(req: NextRequest) {
  const ok = await authorizeCronOrAdmin(req);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let days = 3;
  let customTitle = "";
  let customMessage = "";
  try {
    const body = (await req.json()) as { days?: number; title?: string; message?: string };
    if (body.days) days = Math.min(30, Math.max(1, Number(body.days) || 3));
    if (body.title) customTitle = body.title.trim();
    if (body.message) customMessage = body.message.trim();
  } catch {
    /* default for cron */
  }

  const { tokens, error, hasWinbackCol } = await getDormantTokens(days);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (tokens.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      total: 0,
      message: `No inactive devices (${days}d+) due for a win-back nudge right now.`,
    });
  }

  const pick = WINBACK_MESSAGES[Math.floor(Math.random() * WINBACK_MESSAGES.length)];
  const title = customTitle || pick.title;
  const message = customMessage || pick.message;

  const pushRes = await sendFcmToTokens({
    tokens,
    title,
    message,
    url: pick.url,
  });

  if (!pushRes.ok) {
    return NextResponse.json({ error: pushRes.error }, { status: pushRes.status });
  }

  if (hasWinbackCol) {
    const supa = getSupabaseAdmin();
    if (supa) {
      await supa
        .from("push_tokens")
        .update({ last_winback_at: new Date().toISOString() })
        .in("token", tokens);
    }
  }

  return NextResponse.json({
    ok: true,
    sent: pushRes.sent,
    total: pushRes.total,
    title,
  });
}
