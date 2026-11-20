import { NextRequest, NextResponse } from "next/server";
import {
  getPushCounts,
  getSupabaseAdmin,
  loadServiceAccount,
  PushTarget,
  sendFcmPush,
  verifyAdminCaller,
} from "@/lib/fcmServer";

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

  const sa = loadServiceAccount();
  const supaAdmin = getSupabaseAdmin();

  const counts = supaAdmin
    ? await getPushCounts(supaAdmin)
    : { tableReady: false, deviceCount: 0, androidCount: 0, webCount: 0 };

  return NextResponse.json({
    configured: Boolean(sa && supaAdmin),
    firebaseConfigured: Boolean(sa),
    supabaseServiceConfigured: Boolean(supaAdmin),
    ...counts,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: {
    title?: string;
    message?: string;
    imageUrl?: string | null;
    url?: string | null;
    target?: PushTarget;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const message = (body.message || "").trim();
  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
  }

  const target: PushTarget =
    body.target === "android" || body.target === "web" ? body.target : "all";

  const result = await sendFcmPush({
    title,
    message,
    imageUrl: body.imageUrl,
    url: body.url,
    target,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    total: result.total,
    removed: result.removed,
    target,
  });
}
