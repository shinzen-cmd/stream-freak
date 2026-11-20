import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type PushTarget = "all" | "android" | "web";

export interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvdkpwnonhlvttjdhfkf.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_UV1Zg0OMppUn00rU_82isQ_C5Jb-rOs";

export function loadServiceAccount(): FirebaseServiceAccount | null {
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
      /* fall through */
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

export function getSupabaseAdmin(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifyAdminCaller(req: NextRequest): Promise<{ ok: boolean; error?: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, error: "Missing authorization token." };

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

export async function getPushCounts(supaAdmin: SupabaseClient) {
  const [{ count: total, error: totalErr }, { count: androidCount }, { count: webCount }] =
    await Promise.all([
      supaAdmin.from("push_tokens").select("token", { count: "exact", head: true }),
      supaAdmin
        .from("push_tokens")
        .select("token", { count: "exact", head: true })
        .eq("platform", "android"),
      supaAdmin
        .from("push_tokens")
        .select("token", { count: "exact", head: true })
        .eq("platform", "web"),
    ]);

  return {
    tableReady: !totalErr,
    deviceCount: total ?? 0,
    androidCount: androidCount ?? 0,
    webCount: webCount ?? 0,
  };
}

export async function sendFcmPush(params: {
  title: string;
  message: string;
  imageUrl?: string | null;
  url?: string | null;
  target?: PushTarget;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  sent: number;
  failed: number;
  total: number;
  removed: number;
}> {
  const sa = loadServiceAccount();
  if (!sa) {
    return {
      ok: false,
      status: 503,
      error: "Firebase push is not configured yet (missing FIREBASE_SERVICE_ACCOUNT_JSON).",
      sent: 0,
      failed: 0,
      total: 0,
      removed: 0,
    };
  }

  const supaAdmin = getSupabaseAdmin();
  if (!supaAdmin) {
    return {
      ok: false,
      status: 503,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.",
      sent: 0,
      failed: 0,
      total: 0,
      removed: 0,
    };
  }

  const target: PushTarget = params.target || "all";
  let query = supaAdmin.from("push_tokens").select("token,platform");
  if (target === "android") {
    query = query.eq("platform", "android");
  } else if (target === "web") {
    query = query.eq("platform", "web");
  }

  const { data: rows, error: dbErr } = await query;
  if (dbErr) {
    return {
      ok: false,
      status: 500,
      error: `Failed to read push_tokens: ${dbErr.message}`,
      sent: 0,
      failed: 0,
      total: 0,
      removed: 0,
    };
  }

  const entries = (rows ?? []) as Array<{ token: string; platform?: string }>;
  if (entries.length === 0) {
    return { ok: true, status: 200, sent: 0, failed: 0, total: 0, removed: 0 };
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(sa);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to authenticate with Firebase.",
      sent: 0,
      failed: 0,
      total: entries.length,
      removed: 0,
    };
  }

  const title = params.title.trim();
  const message = params.message.trim();
  const imageUrl = (params.imageUrl || "").trim() || undefined;
  const clickUrl = (params.url || "").trim() || "/";
  const absoluteLink = clickUrl.startsWith("http")
    ? clickUrl
    : `https://streamfreak.xyz${clickUrl.startsWith("/") ? clickUrl : `/${clickUrl}`}`;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  let failed = 0;
  const staleTokens: string[] = [];

  const BATCH_SIZE = 20;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ token: deviceToken }) => {
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
              url: clickUrl,
              ...(imageUrl ? { image: imageUrl } : {}),
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
            webpush: {
              fcm_options: {
                link: absoluteLink,
              },
              notification: {
                icon: "https://streamfreak.xyz/icons/icon-192.png",
                badge: "https://streamfreak.xyz/icons/icon-192.png",
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

  return {
    ok: true,
    status: 200,
    sent,
    failed,
    total: entries.length,
    removed: staleTokens.length,
  };
}
