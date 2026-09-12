import { NextRequest, NextResponse } from "next/server";
import { getPlayerServers } from "@/lib/playerSources";
import { getAnimeStream } from "@/lib/getAnimeStream";
import { MediaType } from "@/types/media";
import { ResolvedDirectStreamResult, StreamSubtitleTrack, StreamAudioTrack } from "@/lib/streamResolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Safely unpack Dean Edwards p,a,c,k,e,d obfuscated JavaScript
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
 * Extract .m3u8 or .mp4 links from HTML or JS content
 */
function findStreamLinks(content: string): { streamUrl: string | null; type: "hls" | "mp4" } {
  const normalized = content.replace(/\\\//g, "/");

  // HLS stream search
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

  // Direct MP4 search
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
function findSubtitles(content: string): StreamSubtitleTrack[] {
  const subtitles: StreamSubtitleTrack[] = [];
  const normalized = content.replace(/\\\//g, "/");

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

/**
 * Attempt stream extraction from a single embed URL
 */
async function extractFromEmbed(targetUrl: string): Promise<{
  streamUrl: string | null;
  type: "hls" | "mp4";
  subtitles: StreamSubtitleTrack[];
}> {
  try {
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin;
    const reqHeaders = {
      "User-Agent": USER_AGENT,
      Referer: `${targetOrigin}/`,
      Origin: targetOrigin,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: reqHeaders,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);
    if (!res.ok) return { streamUrl: null, type: "hls", subtitles: [] };

    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      targetUrl.includes(".m3u8")
    ) {
      return { streamUrl: targetUrl, type: "hls", subtitles: [] };
    }

    const html = await res.text();
    let { streamUrl, type } = findStreamLinks(html);
    let subtitles = findSubtitles(html);

    // Check Dean Edwards packed JS
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

    // Check nested iframes
    if (!streamUrl) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let subUrl = iframeMatch[1].trim();
        if (subUrl.startsWith("//")) subUrl = `https:${subUrl}`;
        else if (subUrl.startsWith("/")) subUrl = `${targetOrigin}${subUrl}`;

        if (subUrl.startsWith("http")) {
          const subController = new AbortController();
          const subTimeout = setTimeout(() => subController.abort(), 3500);
          try {
            const subRes = await fetch(subUrl, {
              headers: { ...reqHeaders, Referer: targetUrl },
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
              }
            }
          } catch {
            // Ignore nested iframe error
          }
        }
      }
    }

    return { streamUrl, type, subtitles };
  } catch {
    return { streamUrl: null, type: "hls", subtitles: [] };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mediaType = (searchParams.get("mediaType") || "movie") as MediaType;
  const id = searchParams.get("id") || "";
  const tmdbId = searchParams.get("tmdbId") ? Number(searchParams.get("tmdbId")) : undefined;
  const anilistId = searchParams.get("anilistId") ? Number(searchParams.get("anilistId")) : undefined;
  const malId = searchParams.get("malId") ? Number(searchParams.get("malId")) : null;
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : 1;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : 1;
  const audioMode = (searchParams.get("audioMode") || "sub") as "sub" | "dub";
  const title = searchParams.get("title") || "";

  if (!id && !tmdbId && !anilistId) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required media identifier (id, tmdbId, or anilistId)",
        audioTracks: [],
        subtitles: [],
      },
      { status: 400 }
    );
  }

  // ── CASE 1: ANIME STREAM RESOLUTION ───────────────────────────────────────
  if (mediaType === "anime") {
    try {
      const animeResult = await getAnimeStream({
        anilistId: anilistId || id,
        malId,
        title,
        episodeNumber: episode,
        audioMode,
      });

      // Default audio tracks for anime
      const audioTracks: StreamAudioTrack[] = [
        { id: "sub", label: "Japanese (Original with Subtitles)", lang: "ja", isDefault: audioMode === "sub" },
        { id: "dub", label: "English Dub", lang: "en", isDefault: audioMode === "dub" },
      ];

      // 1. Direct sources from workers
      if (animeResult.directSources && animeResult.directSources.length > 0) {
        const rawDirect = animeResult.directSources[0].url;
        const proxied = rawDirect.startsWith("/api/proxy/stream")
          ? rawDirect
          : `/api/proxy/stream?url=${encodeURIComponent(rawDirect)}&referer=${encodeURIComponent("https://zorotv.ba/")}`;
        return NextResponse.json({
          success: true,
          streamUrl: proxied,
          rawUrl: rawDirect,
          type: animeResult.directSources[0].type || "hls",
          quality: animeResult.directSources[0].quality || "Auto",
          audioTracks,
          subtitles: animeResult.subtitles.map((s) => ({
            url: s.url,
            lang: s.lang,
            label: s.lang.toUpperCase(),
          })),
          provider: animeResult.provider,
          fallbackEmbedUrl: animeResult.embedUrl,
        } as ResolvedDirectStreamResult);
      }

      // 2. Try extracting from primary embed
      if (animeResult.embedUrl) {
        const extracted = await extractFromEmbed(animeResult.embedUrl);
        if (extracted.streamUrl) {
          const proxied = `/api/proxy/stream?url=${encodeURIComponent(extracted.streamUrl)}&referer=${encodeURIComponent(animeResult.embedUrl)}`;
          return NextResponse.json({
            success: true,
            streamUrl: proxied,
            rawUrl: extracted.streamUrl,
            type: extracted.type,
            quality: "1080p",
            audioTracks,
            subtitles: extracted.subtitles.length > 0
              ? extracted.subtitles
              : animeResult.subtitles.map((s) => ({ url: s.url, lang: s.lang, label: s.lang.toUpperCase() })),
            provider: "Extracted Stream Gateway",
            fallbackEmbedUrl: animeResult.embedUrl,
          } as ResolvedDirectStreamResult);
        }
      }

      // 3. Fallback to embed
      return NextResponse.json({
        success: false,
        streamUrl: null,
        type: "hls",
        audioTracks,
        subtitles: animeResult.subtitles.map((s) => ({ url: s.url, lang: s.lang, label: s.lang.toUpperCase() })),
        provider: animeResult.provider,
        fallbackEmbedUrl: animeResult.embedUrl || animeResult.fallbackEmbeds?.[0]?.url,
      } as ResolvedDirectStreamResult);
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: err?.message || "Anime stream resolution error",
          audioTracks: [],
          subtitles: [],
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: false,
    streamUrl: null,
    type: "hls",
    audioTracks: [],
    subtitles: [],
    provider: "Embed Fallback",
    fallbackEmbedUrl: "",
  } as ResolvedDirectStreamResult);
}

