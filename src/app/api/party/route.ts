import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvdkpwnonhlvttjdhfkf.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_UV1Zg0OMppUn00rU_82isQ_C5Jb-rOs";

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCallerUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function sanitizeStartUrl(raw: string | undefined, fallbackOrigin: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return fallbackOrigin;
  if (trimmed.startsWith("/")) {
    return `${fallbackOrigin}${trimmed}`;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
  } catch {
    /* fall back */
  }
  return fallbackOrigin;
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({
      configured: Boolean(process.env.HYPERBEAM_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { error: "Watch Party is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const { data, error } = await supa
    .from("watch_parties")
    .select("code,title,host_id,host_name,embed_url,active,created_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || !data.active) {
    return NextResponse.json(
      { error: "Watch Party room not found or has already ended." },
      { status: 404 }
    );
  }

  return NextResponse.json({ room: data });
}

export async function POST(req: NextRequest) {
  const hyperbeamKey = process.env.HYPERBEAM_API_KEY;
  if (!hyperbeamKey) {
    return NextResponse.json(
      { error: "Watch Party is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { error: "Watch Party is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const user = await getCallerUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to create a Watch Party room." },
      { status: 401 }
    );
  }

  let body: { title?: string; startUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* default empty */
  }

  const fallbackOrigin = req.nextUrl.origin || "https://streamfreak.xyz";
  const startUrl = sanitizeStartUrl(body.startUrl, fallbackOrigin);
  const title = (body.title || "").trim().slice(0, 80) || "Stream Freak Watch Party";
  const hostName = (user.email || "Host").split("@")[0].slice(0, 28);

  // Create Hyperbeam virtual browser session
  const hbRes = await fetch("https://engine.hyperbeam.com/v0/vm", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hyperbeamKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start_url: startUrl,
      ublock: true,
      width: 1280,
      height: 720,
      fps: 30,
      timeout: {
        offline: 300,
        inactive: 1800,
      },
    }),
  });

  if (!hbRes.ok) {
    return NextResponse.json(
      { error: "Could not launch Watch Party room right now. Please try again in a moment." },
      { status: 502 }
    );
  }

  const hbData = (await hbRes.json()) as {
    session_id?: string;
    embed_url?: string;
    admin_token?: string;
  };

  if (!hbData.session_id || !hbData.embed_url) {
    return NextResponse.json(
      { error: "Could not start Watch Party session. Please try again." },
      { status: 502 }
    );
  }

  const code = generateRoomCode();
  const { error: insertErr } = await supa.from("watch_parties").insert({
    code,
    title,
    host_id: user.id,
    host_name: hostName,
    session_id: hbData.session_id,
    embed_url: hbData.embed_url,
    admin_token: hbData.admin_token ?? null,
    active: true,
  });

  if (insertErr) {
    // Clean up Hyperbeam VM if DB insert fails
    await fetch(`https://engine.hyperbeam.com/v0/vm/${hbData.session_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${hyperbeamKey}` },
    }).catch(() => {});
    return NextResponse.json(
      { error: `Could not save room: ${insertErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    room: {
      code,
      title,
      host_id: user.id,
      host_name: hostName,
      embed_url: hbData.embed_url,
      active: true,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Room code is required." }, { status: 400 });
  }

  const hyperbeamKey = process.env.HYPERBEAM_API_KEY;
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }

  const user = await getCallerUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: room } = await supa
    .from("watch_parties")
    .select("code,host_id,session_id")
    .eq("code", code)
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: profile } = await supa
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (room.host_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Only the room host can end this Watch Party." }, { status: 403 });
  }

  if (hyperbeamKey && room.session_id) {
    await fetch(`https://engine.hyperbeam.com/v0/vm/${room.session_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${hyperbeamKey}` },
    }).catch(() => {});
  }

  await supa.from("watch_parties").update({ active: false }).eq("code", code);

  return NextResponse.json({ ok: true });
}
