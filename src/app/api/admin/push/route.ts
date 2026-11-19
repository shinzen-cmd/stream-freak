import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): FirebaseServiceAccount | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Partial<FirebaseServiceAccount>;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      /* fall through to individual env vars */
    }
  }

  const project_id = process.env.FIREBASE_PROJECT_ID;
  const client_email = process.env.FIREBASE_CLIENT_EMAIL;
  const private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (project_id && client_email && private_key) {
    return { project_id, client_email, private_key };
  }
  return null;
}

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvdkpwnonhlvttjdhfkf.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyAdminCaller(req: NextRequest): Promise<{ ok: boolean; error?: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, error: "Missing authorization token." };

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvdkpwnonhlvttjdhfkf.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_qC_Q8dL3l1xZ3K648h9i2w_l8lB2l1M";

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await client.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, error: "Invalid or expired session." };
  }

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Admin privileges required." };
  }
  return { ok: true };
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(sa: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64Url(signer.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth failed (${tokenRes.status}): ${errText}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Google OAuth did not return an access_token.");
  }
  return tokenJson.access_token;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const sa = loadServiceAccount();
  const supaAdmin = getSupabaseAdmin();

  let deviceCount = 0;
  let tableReady = true;
  if (supaAdmin) {
    const { count, error } = await supaAdmin
      .from("push_tokens")
      .select("token", { count: "exact", head: true });
    if (error) {
      tableReady = false;
    } else {
      deviceCount = count ?? 0;
    }
  }

  return NextResponse.json({
    configured: Boolean(sa && supaAdmin),
    firebaseConfigured: Boolean(sa),
    supabaseServiceConfigured: Boolean(supaAdmin),
    tableReady,
    deviceCount,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const sa = loadServiceAccount();
  if (!sa) {
    return NextResponse.json(
      {
        error:
          "Firebase push is not configured yet. Add FIREBASE_SERVICE_ACCOUNT_JSON to Vercel Environment Variables.",
      },
      { status: 503 }
    );
  }

  const supaAdmin = getSupabaseAdmin();
  if (!supaAdmin) {
    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables to read registered device tokens.",
      },
      { status: 503 }
    );
  }

  let body: { title?: string; message?: string; imageUrl?: string | null; url?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const message = (body.message || "").trim();
  const imageUrl = (body.imageUrl || "").trim() || undefined;
  const clickUrl = (body.url || "").trim() || undefined;

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
  }

  const { data: rows, error: dbErr } = await supaAdmin
    .from("push_tokens")
    .select("token");

  if (dbErr) {
    return NextResponse.json(
      { error: `Failed to read push_tokens: ${dbErr.message}` },
      { status: 500 }
    );
  }

  const tokens = (rows ?? []).map((r) => r.token as string).filter(Boolean);
  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, removed: 0 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(sa);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to authenticate with Firebase." },
      { status: 500 }
    );
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  let failed = 0;
  const staleTokens: string[] = [];

  const BATCH_SIZE = 20;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (deviceToken) => {
        const payload = {
          message: {
            token: deviceToken,
            notification: {
              title,
              body: message,
              ...(imageUrl ? { image: imageUrl } : {}),
            },
            data: {
              title,
              body: message,
              ...(clickUrl ? { url: clickUrl } : {}),
            },
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "stream_freak_general",
                sound: "default",
                color: "#10b981",
                ...(imageUrl ? { image: imageUrl } : {}),
              },
            },
          },
        };

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            sent++;
          } else {
            failed++;
            const errJson = (await res.json().catch(() => null)) as {
              error?: { status?: string; details?: Array<{ errorCode?: string }> };
            } | null;
            const errorCode = errJson?.error?.details?.[0]?.errorCode;
            if (
              errorCode === "UNREGISTERED" ||
              errJson?.error?.status === "NOT_FOUND" ||
              errJson?.error?.status === "INVALID_ARGUMENT"
            ) {
              staleTokens.push(deviceToken);
            }
          }
        } catch {
          failed++;
        }
      })
    );
  }

  if (staleTokens.length > 0) {
    await supaAdmin.from("push_tokens").delete().in("token", staleTokens);
  }

  return NextResponse.json({
    sent,
    failed,
    total: tokens.length,
    removed: staleTokens.length,
  });
}
