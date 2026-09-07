import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface ExtractedSubtitle {
  url: string;
  lang: string;
  label?: string;
}

/**
 * Pure TypeScript unpacker for Dean Edwards p,a,c,k,e,d obfuscated JavaScript.
 * Runs safely without executing code or calling eval().
 */
function unpackPackedJs(packedCode: string): string {
  try {
    const match = packedCode.match(
      /}\s*\(\s*['"]([\s\S]+?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/
    );
    if (!match) return "";

    const [, payload, aStr, cStr, keyStr] = match;
    const a = parseInt(aStr, 10);
    let c = parseInt(cStr, 10);
    const k = keyStr.split("|");

    const e = (val: number): string => {
      return (
        (val < a ? "" : e(Math.floor(val / a))) +
        ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36))
      );
    };

    const dict: Record<string, string> = {};
    while (c--) {
      dict[e(c)] = k[c] || e(c);
    }

    return payload.replace(/\b\w+\b/g, (w) => dict[w] || w);
  } catch {
    return "";
  }
}

/**
 * Searches HTML or script content for .m3u8 or direct .mp4 streaming sources.
 */
function findStreamLinks(content: string): { streamUrl: string | null; type: "hls" | "mp4" } {
  // Normalize escaped backslashes commonly found in JSON responses (e.g., https:\/\/...)
  const normalized = content.replace(/\\\//g, "/");

  // 1. Check for explicit HLS stream files
  const m3u8Matches = [
    /file\s*:\s*["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
    /source\s*:\s*["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
    /src\s*:\s*["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
    /"url"\s*:\s*["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
    /["'](https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)["']/i,
  ];

  for (const regex of m3u8Matches) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const url = match[1].trim();
      if (!url.includes("google") && !url.includes("analytics") && !url.includes("track")) {
        return { streamUrl: url, type: "hls" };
      }
    }
  }

  // 2. Check for direct MP4 video sources
  const mp4Matches = [
    /file\s*:\s*["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i,
    /source\s*:\s*["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i,
    /src\s*:\s*["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i,
    /"url"\s*:\s*["'](https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']/i,
  ];

  for (const regex of mp4Matches) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const url = match[1].trim();
      return { streamUrl: url, type: "mp4" };
    }
  }

  return { streamUrl: null, type: "hls" };
}

/**
 * Searches for subtitle cues in HTML or JS objects
 */
function findSubtitles(content: string): ExtractedSubtitle[] {
  const subtitles: ExtractedSubtitle[] = [];
  const normalized = content.replace(/\\\//g, "/");

  // Track elements: <track kind="subtitles" src="..." label="..." srclang="..." />
  const trackRegex = /<track[^>]+src=["']([^"']+\.(?:vtt|srt)[^"']*)["'][^>]*>/gi;
  let trackMatch;
  while ((trackMatch = trackRegex.exec(normalized)) !== null) {
    const trackTag = trackMatch[0];
    const src = trackMatch[1];
    const labelMatch = trackTag.match(/label=["']([^"']+)["']/i);
    const langMatch = trackTag.match(/srclang=["']([^"']+)["']/i);
    subtitles.push({
      url: src,
      lang: langMatch ? langMatch[1] : labelMatch ? labelMatch[1] : "en",
      label: labelMatch ? labelMatch[1] : "English",
    });
  }

  // JSON tracks definition: tracks: [{ file: "...", label: "..." }]
  const jsonTrackRegex = /\{\s*file\s*:\s*["']([^"']+\.(?:vtt|srt)[^"']*)["']\s*,\s*label\s*:\s*["']([^"']+)["']/gi;
  let jsonMatch;
  while ((jsonMatch = jsonTrackRegex.exec(normalized)) !== null) {
    subtitles.push({
      url: jsonMatch[1],
      lang: jsonMatch[2].toLowerCase().slice(0, 2),
      label: jsonMatch[2],
    });
  }

  return subtitles;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Bad Request", message: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid target URL" },
      { status: 400 }
    );
  }

  const targetOrigin = parsedTarget.origin;
  const reqHeaders = {
    "User-Agent": USER_AGENT,
    Referer: `${targetOrigin}/`,
    Origin: targetOrigin,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    // 1. Fetch the target embed page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: reqHeaders,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Upstream embed returned status ${res.status}`,
          fallbackUrl: targetUrl,
        },
        { status: 200 }
      );
    }

    const contentType = res.headers.get("content-type") || "";

    // If the response is already directly an HLS playlist or MP4 stream
    if (
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      targetUrl.includes(".m3u8")
    ) {
      const proxied = `/api/proxy/stream?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(targetUrl)}`;
      return NextResponse.json({
        success: true,
        streamUrl: proxied,
        rawUrl: targetUrl,
        type: "hls",
        subtitles: [],
      });
    }

    const html = await res.text();

    // 2. Direct search in page HTML
    let { streamUrl, type } = findStreamLinks(html);
    let subtitles = findSubtitles(html);

    // 3. Search inside Dean Edwards packed JS if present
    if (!streamUrl && html.includes("eval(function(p,a,c,k,e,d)")) {
      const packedParts = html.split("eval(function(p,a,c,k,e,d)");
      for (let i = 1; i < packedParts.length; i++) {
        const snippet = "eval(function(p,a,c,k,e,d)" + packedParts[i].split("</script>")[0];
        const unpacked = unpackPackedJs(snippet);
        if (unpacked) {
          const unpackedRes = findStreamLinks(unpacked);
          if (unpackedRes.streamUrl) {
            streamUrl = unpackedRes.streamUrl;
            type = unpackedRes.type;
            const unpackedSubs = findSubtitles(unpacked);
            if (unpackedSubs.length > 0) subtitles = unpackedSubs;
            break;
          }
        }
      }
    }

    // 4. Check for nested player iframes (e.g., VidSrc /srcrc/ or sub-server mirrors)
    if (!streamUrl) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let subUrl = iframeMatch[1].trim();
        if (subUrl.startsWith("//")) {
          subUrl = `https:${subUrl}`;
        } else if (subUrl.startsWith("/")) {
          subUrl = `${targetOrigin}${subUrl}`;
        }

        if (subUrl.startsWith("http")) {
          try {
            const subController = new AbortController();
            const subTimeout = setTimeout(() => subController.abort(), 4000);
            const subRes = await fetch(subUrl, {
              headers: {
                ...reqHeaders,
                Referer: targetUrl,
              },
              signal: subController.signal,
            });
            clearTimeout(subTimeout);

            if (subRes.ok) {
              const subText = await subRes.text();
              const subStream = findStreamLinks(subText);
              if (subStream.streamUrl) {
                streamUrl = subStream.streamUrl;
                type = subStream.type;
                const subSubs = findSubtitles(subText);
                if (subSubs.length > 0) subtitles = subSubs;
              } else if (subText.includes("eval(function(p,a,c,k,e,d)")) {
                const unpackedSub = unpackPackedJs(subText);
                const unpackedSubStream = findStreamLinks(unpackedSub);
                if (unpackedSubStream.streamUrl) {
                  streamUrl = unpackedSubStream.streamUrl;
                  type = unpackedSubStream.type;
                }
              }
            }
          } catch {
            // Ignore sub-iframe fetch failure
          }
        }
      }
    }

    // 5. Result response
    if (streamUrl) {
      const proxied = `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(targetUrl)}`;
      return NextResponse.json({
        success: true,
        streamUrl: proxied,
        rawUrl: streamUrl,
        type,
        subtitles,
      });
    }

    // No direct stream extracted: indicate fallback to sandboxed iframe
    return NextResponse.json({
      success: false,
      error: "Direct stream manifest not found in provider output",
      fallbackUrl: targetUrl,
      subtitles: [],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Stream resolution error",
        details: err?.message || String(err),
        fallbackUrl: targetUrl,
      },
      { status: 200 }
    );
  }
}
