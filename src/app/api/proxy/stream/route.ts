import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Default spoofed headers to bypass anti-scraping and CDN protection
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Helper to resolve and rewrite an internal HLS URI through this proxy endpoint
 */
function proxyUrl(rawUri: string, baseUrl: string, referer: string, sessionToken?: string): string {
  try {
    const trimmed = rawUri.trim();
    if (!trimmed) return rawUri;
    if (trimmed.startsWith("/api/proxy/stream")) {
      if (sessionToken && !trimmed.includes("sessionToken=")) {
        return `${trimmed}&sessionToken=${encodeURIComponent(sessionToken)}`;
      }
      return trimmed;
    }

    // Resolve relative paths against the manifest base URL
    const absolute = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : new URL(trimmed, baseUrl).href;

    let proxied = `/api/proxy/stream?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}`;
    if (sessionToken) {
      proxied += `&sessionToken=${encodeURIComponent(sessionToken)}`;
    }
    return proxied;
  } catch {
    return rawUri;
  }
}

/**
 * Parses and rewrites M3U8 playlists (both master and media playlists)
 * including media segments, child manifests, encryption keys, and alternate audio/sub tracks.
 */
function rewriteM3u8Manifest(
  manifestText: string,
  targetUrl: string,
  referer: string,
  sessionToken?: string
): string {
  const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

  return manifestText
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Empty lines remain untouched
      if (!trimmed) return line;

      // Handle HLS tag lines that contain embedded URI attributes (Keys, Init maps, Audio/Sub tracks)
      if (trimmed.startsWith("#")) {
        // Rewrite URI attributes in #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.
        // Format: URI="path/to/key.key" or URI='path/to/init.mp4'
        if (trimmed.includes('URI="') || trimmed.includes("URI='")) {
          return trimmed.replace(/URI=["']([^"']+)["']/g, (_, uriValue) => {
            const proxied = proxyUrl(uriValue, baseUrl, referer, sessionToken);
            return `URI="${proxied}"`;
          });
        }
        return line;
      }

      // Non-comment lines are direct video segment or child manifest URLs
      return proxyUrl(trimmed, baseUrl, referer, sessionToken);
    })
    .join("\n");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "Missing mandatory 'url' query parameter.",
      },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedTarget.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "Malformed target stream URL provided.",
      },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  // Extract url, referer, sessionToken, and custom headers from query parameters
  const sessionToken =
    searchParams.get("sessionToken") ||
    searchParams.get("token") ||
    searchParams.get("t") ||
    searchParams.get("sig") ||
    "";

  // Derive target origin and referer
  const targetOrigin = parsedTarget.origin;
  let referer = searchParams.get("referer") || `${targetOrigin}/`;

  // Upstream CDN compatibility: megavid.buzz CDNs reject third-party referers on HLS manifests
  if (parsedTarget.hostname.includes("megavid.buzz") && referer.includes("zorotv.ba")) {
    referer = "https://megavid.buzz/";
  }

  let requestOrigin = targetOrigin;
  try {
    if (referer && (referer.startsWith("http://") || referer.startsWith("https://"))) {
      requestOrigin = new URL(referer).origin;
    }
  } catch {}

  // Pass the captured sessionToken in query parameters if not already in target URL
  let upstreamFetchUrl = targetUrl;
  if (sessionToken && !parsedTarget.searchParams.has("token") && !parsedTarget.searchParams.has("sessionToken")) {
    try {
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set("token", sessionToken);
      upstreamFetchUrl = urlObj.href;
    } catch {}
  }

  // Build upstream request headers with spoofed session context
  const upstreamHeaders = new Headers();
  upstreamHeaders.set("User-Agent", searchParams.get("ua") || DEFAULT_USER_AGENT);
  upstreamHeaders.set("Referer", referer);
  upstreamHeaders.set("Origin", requestOrigin);
  upstreamHeaders.set("Accept", "*/*");
  upstreamHeaders.set("Accept-Language", "en-US,en;q=0.9");
  upstreamHeaders.set("Sec-Fetch-Dest", "empty");
  upstreamHeaders.set("Sec-Fetch-Mode", "cors");
  upstreamHeaders.set("Sec-Fetch-Site", "cross-site");

  if (sessionToken) {
    upstreamHeaders.set("X-Session-Token", sessionToken);
    upstreamHeaders.set("Authorization", `Bearer ${sessionToken}`);
    const clientCookie = searchParams.get("cookie") || `token=${sessionToken}; sessionToken=${sessionToken}`;
    upstreamHeaders.set("Cookie", clientCookie);
  }

  // Pass Range headers through for seeking and chunked playback support
  const clientRange = req.headers.get("range");
  if (clientRange) {
    upstreamHeaders.set("Range", clientRange);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstreamRes = await fetch(upstreamFetchUrl, {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        {
          error: "Upstream Stream Error",
          status: upstreamRes.status,
          statusText: upstreamRes.statusText,
          targetUrl,
        },
        {
          status: 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isM3U8 =
      targetUrl.toLowerCase().includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("audio/x-mpegurl");

    // ── CASE 1: M3U8 PLAYLIST MANIFEST ───────────────────────────────────────
    if (isM3U8) {
      const originalManifest = await upstreamRes.text();

      // Check if it's a valid HLS manifest
      if (!originalManifest.includes("#EXTM3U")) {
        // Fallback: If returned non-M3U8 text (e.g. anti-bot landing page or error)
        return new NextResponse(originalManifest, {
          status: upstreamRes.status,
          headers: {
            "Content-Type": contentType || "text/plain",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        });
      }

      const rewrittenManifest = rewriteM3u8Manifest(originalManifest, upstreamFetchUrl, referer, sessionToken);

      return new NextResponse(rewrittenManifest, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Expose-Headers": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // ── CASE 2: BINARY VIDEO SEGMENT (.ts, .m4s, .mp4, audio) ───────────────
    const forwardHeaders = new Headers();
    forwardHeaders.set("Access-Control-Allow-Origin", "*");
    forwardHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    forwardHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

    // Preserve important streaming headers
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ];

    for (const key of headersToForward) {
      const val = upstreamRes.headers.get(key);
      if (val) forwardHeaders.set(key, val);
    }

    // Ensure correct MIME type for standard media chunks
    if (targetUrl.toLowerCase().includes(".ts")) {
      forwardHeaders.set("content-type", "video/mp2t");
    } else if (targetUrl.toLowerCase().includes(".m4s") || targetUrl.toLowerCase().includes(".mp4")) {
      forwardHeaders.set("content-type", "video/mp4");
    } else if (!forwardHeaders.has("content-type")) {
      forwardHeaders.set("content-type", "application/octet-stream");
    }

    // Cache segments for 1 hour to prevent fragment timeouts and enable instant seeking
    forwardHeaders.set("Cache-Control", "public, max-age=3600, immutable");
    forwardHeaders.delete("Pragma");
    forwardHeaders.delete("Expires");

    return new NextResponse(upstreamRes.body as any, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: forwardHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Bad Gateway",
        message: "Failed to establish connection to upstream media server.",
        details: err?.message || String(err),
      },
      {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

export async function HEAD(req: NextRequest) {
  return GET(req);
}
