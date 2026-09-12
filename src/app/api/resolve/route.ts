import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const SESSION_LOCKED_HOSTS = [
  "megavid.buzz",
  "cp.megavid.buzz",
  "zorotv.ba",
  "api-webs.com",
  "cdn.api-webs.com",
  "vidlink.pro",
  "vidsrc.cc",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface ExtractedSubtitle {
  url: string;
  lang: string;
  label?: string;
}

interface MovieboxStreamResult {
  streamUrl: string;
  rawUrl: string;
  referer: string;
}

/**
 * Searches HTML or script content for .m3u8 or direct .mp4 streaming sources.
 */
function findStreamLinks(content: string): { streamUrl: string | null; type: "hls" | "mp4" } {
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
 * Extracts TMDB media metadata from target URL and search parameters
 */
function extractMediaMetadata(targetUrl: string | null, searchParams: URLSearchParams) {
  let tmdbId = searchParams.get("tmdbId") || searchParams.get("id") || "";
  let mediaType = searchParams.get("mediaType") || searchParams.get("type") || "movie";
  let season = searchParams.get("season") || "1";
  let episode = searchParams.get("episode") || "1";

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      if (!tmdbId) {
        tmdbId =
          parsed.searchParams.get("tmdb") ||
          parsed.searchParams.get("tmdbId") ||
          parsed.searchParams.get("id") ||
          parsed.searchParams.get("video_id") ||
          "";
      }
      if (searchParams.get("season") == null && (parsed.searchParams.has("season") || parsed.searchParams.has("s"))) {
        season = parsed.searchParams.get("season") || parsed.searchParams.get("s") || "1";
      }
      if (searchParams.get("episode") == null && (parsed.searchParams.has("episode") || parsed.searchParams.has("e"))) {
        episode = parsed.searchParams.get("episode") || parsed.searchParams.get("e") || "1";
      }
      if (searchParams.get("mediaType") == null && searchParams.get("type") == null) {
        if (targetUrl.includes("/tv/") || targetUrl.includes("embedtv") || parsed.searchParams.has("s")) {
          mediaType = "tv";
        }
      }

      if (!tmdbId) {
        const pathMatches = [
          /\/embed\/(?:movie|tv|anime|video)\/([0-9]+)/i,
          /\/embed\/([0-9]+)/i,
          /\/(?:movie|tv)\/([0-9]+)/i,
          /\/mal\/([0-9]+)/i,
          /\/([0-9]{3,8})/i,
        ];
        for (const regex of pathMatches) {
          const m = parsed.pathname.match(regex);
          if (m && m[1]) {
            tmdbId = m[1];
            break;
          }
        }
      }

      const seMatch = parsed.pathname.match(/\/(?:tv|anime)\/[0-9]+\/([0-9]+)\/([0-9]+)/i);
      if (seMatch) {
        season = seMatch[1];
        episode = seMatch[2];
      }
    } catch {}
  }

  const cleanTmdbId = tmdbId.replace(/[^0-9]/g, "");
  const cleanSeason = parseInt(season, 10) || 1;
  const cleanEpisode = parseInt(episode, 10) || 1;
  const cleanMediaType = mediaType === "tv" ? "tv" : "movie";

  return {
    tmdbId: cleanTmdbId,
    mediaType: cleanMediaType as "movie" | "tv",
    season: cleanSeason,
    episode: cleanEpisode,
  };
}

/**
 * Primary Resolver: Queries Moviebox-API for direct streaming sources.
 * Endpoint: process.env.MOVIEBOX_API_URL || "https://moviebox-api-six.vercel.app/api/"
 */
async function fetchMovieboxStream(
  tmdbId: string,
  mediaType: "movie" | "tv",
  season: number,
  episode: number,
  embedLink?: string | null
): Promise<MovieboxStreamResult | null> {
  const baseUrl = (process.env.MOVIEBOX_API_URL || "https://moviebox-api-six.vercel.app/api/").trim();
  const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const candidates: string[] = [];

  if (tmdbId) {
    const q1 = new URLSearchParams({
      id: tmdbId,
      tmdbId,
      type: mediaType,
      season: String(season),
      episode: String(episode),
    });
    candidates.push(`${cleanBase}?${q1.toString()}`);
    candidates.push(`${cleanBase}stream?${q1.toString()}`);
    candidates.push(`${cleanBase}${mediaType}?${q1.toString()}`);
  }

  if (embedLink) {
    const q2 = new URLSearchParams({ url: embedLink });
    candidates.push(`${cleanBase}?${q2.toString()}`);
    candidates.push(`${cleanBase}resolve?${q2.toString()}`);
  }

  for (const candidateUrl of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(candidateUrl, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json, text/plain, */*",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      let rawM3u8: string | null = null;
      let referer = "https://themoviebox.xyz/";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        rawM3u8 =
          data?.streamUrl ||
          data?.url ||
          data?.source ||
          data?.file ||
          data?.data?.url ||
          data?.data?.streamUrl ||
          data?.streams?.[0]?.url ||
          data?.sources?.[0]?.url ||
          null;

        if (data?.referer) referer = data.referer;
      } else {
        const text = await res.text();
        const found = findStreamLinks(text);
        rawM3u8 = found.streamUrl;
      }

      if (rawM3u8 && (rawM3u8.includes(".m3u8") || rawM3u8.includes(".mp4"))) {
        const proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(rawM3u8)}&referer=${encodeURIComponent(referer)}`;
        return {
          streamUrl: proxiedUrl,
          rawUrl: rawM3u8,
          referer,
        };
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  const directId = searchParams.get("tmdbId") || searchParams.get("id");

  if (!targetUrl && !directId) {
    return NextResponse.json(
      { error: "Bad Request", message: "Missing 'url' or 'id' query parameter" },
      { status: 400 }
    );
  }

  // 1. Extract metadata
  const meta = extractMediaMetadata(targetUrl, searchParams);
  const tmdbId = meta.tmdbId;
  const mediaType = meta.mediaType;
  const season = meta.season;
  const episode = meta.episode;

  // 2. Primary Resolver: Query Moviebox-API
  if (tmdbId || targetUrl) {
    const movieboxResult = await fetchMovieboxStream(tmdbId, mediaType, season, episode, targetUrl);
    if (movieboxResult?.streamUrl) {
      return NextResponse.json(
        {
          success: true,
          useNativeEmbed: false,
          streamUrl: movieboxResult.streamUrl,
          rawUrl: movieboxResult.rawUrl,
          type: "hls",
          provider: "Moviebox-API Direct",
          subtitles: [],
        },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  }

  // Megavid fallback embed URL
  const fallbackTmdbId = tmdbId || "550";
  const megavidUrl =
    mediaType === "tv" && season && episode
      ? `https://megavid.buzz/embed/${fallbackTmdbId}/${season}/${episode}`
      : `https://megavid.buzz/embed/${fallbackTmdbId}`;

  // If targetUrl is an explicit session-locked host, route cleanly to fallback embed
  if (targetUrl) {
    let parsedTarget: URL | null = null;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {}

    const isSessionLocked =
      parsedTarget &&
      SESSION_LOCKED_HOSTS.some(
        (host) =>
          parsedTarget!.hostname.toLowerCase().includes(host.toLowerCase()) ||
          targetUrl.toLowerCase().includes(host.toLowerCase())
      );

    if (isSessionLocked) {
      return NextResponse.json(
        {
          success: true,
          useNativeEmbed: true,
          embedUrl: targetUrl.includes("megavid.buzz") ? targetUrl : megavidUrl,
          streamUrl: null,
          provider: "Megavid Fallback Embed",
          subtitles: [],
        },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  }

  // 3. Secondary Resolver (Fallback): Mount Megavid cleanly via OverlayAdBlocker
  return NextResponse.json(
    {
      success: true,
      useNativeEmbed: true,
      embedUrl: megavidUrl,
      streamUrl: null,
      fallbackUrl: megavidUrl,
      provider: "Megavid Fallback Embed",
      subtitles: [],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
