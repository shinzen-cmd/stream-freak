/**
 * Anime Stream Source Resolver
 * Directly queries multi-origin Cloudflare Workers from the client / Android WebView.
 * Decrypts AES-GCM responses directly in browser crypto.subtle.
 */

export interface AnimeStreamParams {
  anilistId: number | string;
  title: string;
  romajiTitle?: string;
  englishTitle?: string;
  episodeNumber: number;
  malId?: number | string | null;
  audioMode?: "sub" | "dub";
}

export interface DirectStreamSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  type: "hls" | "mp4";
}

export interface AnimeStreamResult {
  success: boolean;
  provider: string;
  tier: 1 | 2 | 3;
  directSources: DirectStreamSource[];
  subtitles: Array<{ url: string; lang: string }>;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  embedUrl: string;
  downloadUrl?: string | null;
  fallbackEmbeds: Array<{ id: string; name: string; url: string; quality?: string }>;
}

const WORKERS = [
  "https://aniflix-api-v5-staging.aniflix-00.workers.dev",
  "https://aniflix-api-v5-staging.adhikaryalif.workers.dev",
  "https://aniflix-api-v5-staging.dontplaydumb.workers.dev",
  "https://aniflix-api-v5-staging.animeapinotforchildern.workers.dev",
];

const SECRET = "aniflix-browser-transport-v1";
const TIMEOUT_MS = 7000;

async function getKey(secret: string) {
  const enc = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decryptAniflix(t: string, secret = SECRET): Promise<any> {
  if (!t || typeof t !== "string") return null;
  try {
    const key = await getKey(secret);
    let n = t.replace(/-/g, "+").replace(/_/g, "/");
    while (n.length % 4) n += "=";
    const o = atob(n);
    const l = Uint8Array.from(o, (x) => x.charCodeAt(0));
    if (l.length < 13) return null;
    const iv = l.slice(0, 12);
    const data = l.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const text = new TextDecoder().decode(decrypted);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function simplifySubtitleLabel(raw: string): string {
  const s = String(raw || "").trim();
  const lower = s.toLowerCase();
  if (lower.includes("eng") || lower.includes("en")) return "English";
  if (lower.includes("spa") || lower.includes("es")) return "Spanish";
  if (lower.includes("fre") || lower.includes("fra") || lower.includes("fr")) return "French";
  if (lower.includes("ger") || lower.includes("de")) return "German";
  if (lower.includes("ita") || lower.includes("it")) return "Italian";
  if (lower.includes("por") || lower.includes("pt")) return "Portuguese";
  if (lower.includes("rus") || lower.includes("ru")) return "Russian";
  if (lower.includes("ara") || lower.includes("ar")) return "Arabic";
  if (lower.includes("hin") || lower.includes("hi")) return "Hindi";
  if (lower.includes("ind") || lower.includes("id")) return "Indonesian";
  if (lower.includes("jp") || lower.includes("jap")) return "Japanese";
  const clean = s.split(/[\(\[\{]/)[0].trim();
  return clean || "English";
}

async function queryWorker(path: string) {
  try {
    return await Promise.any(
      WORKERS.map(async (w) => {
        const data = await fetchWithTimeout(`${w}${path}`, 3500);
        if (data && (data.ok || data.anime || data.media || data.enc)) {
          if (data.enc) {
            const decrypted = await decryptAniflix(data.enc);
            if (decrypted) return { worker: w, data: decrypted };
          }
          return { worker: w, data };
        }
        throw new Error("No data");
      })
    );
  } catch {
    return null;
  }
}

function isValidId(val: unknown): boolean {
  if (val == null) return false;
  const s = String(val).trim();
  return s !== "" && s !== "undefined" && s !== "null" && s !== "0";
}

export function getAnimeEmbedMirrors(
  params: AnimeStreamParams
): Array<{ id: string; name: string; url: string; quality?: string }> {
  const cleanAniId = String(params.anilistId).replace("anime-", "").trim();
  const ep = params.episodeNumber || 1;
  const hasMalId = isValidId(params.malId);
  const cleanMalId = hasMalId ? String(params.malId!).replace("anime-", "").trim() : null;
  const primaryId = cleanMalId || cleanAniId;
  const audioSuffix = params.audioMode === "dub" ? "dub" : "sub";

  const sVidSrcMe = cleanMalId
    ? `https://vidsrc.me/embed/anime?mal=${cleanMalId}&episode=${ep}`
    : `https://vidsrc.me/embed/anime?anilist=${cleanAniId}&episode=${ep}`;

  const sVidSrcPm = cleanMalId
    ? `https://vidsrc.pm/embed/anime/${cleanMalId}/${ep}`
    : `https://vidsrc.pm/embed/anime/${cleanAniId}/${ep}`;

  const sVidSrcSu = cleanMalId
    ? `https://vidsrc.su/embed/anime/${cleanMalId}/${ep}`
    : `https://vidsrc.su/embed/anime/${cleanAniId}/${ep}`;

  const sMultiEmbed = `https://multiembed.mov/?video_id=${primaryId}&is_anime=1&s=1&e=${ep}`;
  const s2Embed = `https://2embed.cc/embedtv/${cleanAniId}&s=1&e=${ep}`;

  const sVidLink = cleanMalId
    ? `https://vidlink.pro/anime/${cleanMalId}/${ep}/${audioSuffix}`
    : `https://vidlink.pro/anime/${cleanAniId}/${ep}/${audioSuffix}`;

  return [
    { id: "s-vidsrc-me", name: "Server 1", url: sVidSrcMe },
    { id: "s-vidsrc-pm", name: "Server 2", url: sVidSrcPm },
    { id: "s-vidsrc-su", name: "Server 3", url: sVidSrcSu },
    { id: "s-multiembed", name: "Server 4", url: sMultiEmbed },
    { id: "s-2embed", name: "Server 5", url: s2Embed },
    { id: "s-vidlink", name: "Server 6", url: sVidLink },
  ];
}

const streamCache = new Map<string, { data: AnimeStreamResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getAnimeStream(params: AnimeStreamParams): Promise<AnimeStreamResult> {
  const cleanAniId = String(params.anilistId).replace("anime-", "").trim();
  const ep = params.episodeNumber || 1;
  const audio = params.audioMode || "sub";
  const langKey = audio === "dub" ? "eng" : "jap";
  const cacheKey = `${cleanAniId}:${ep}:${audio}`;
  const now = Date.now();

  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;

  const fallbackEmbeds = getAnimeEmbedMirrors(params);

  // Fast path: skip worker queries, go straight to embed mirrors
  const quickResult: AnimeStreamResult = {
    success: true,
    provider: "Embed Mirror Gateway",
    tier: 3,
    directSources: [],
    subtitles: [],
    embedUrl: fallbackEmbeds[0]?.url ?? "",
    fallbackEmbeds,
  };
  return quickResult;

  try {
    const malId = isValidId(params.malId) ? String(params.malId) : "";
    const title = params.title || "";

    let epQuery = await queryWorker(
      `/api/anime/episodes?anilistId=${cleanAniId}&animeTitle=${encodeURIComponent(title)}&malId=${malId}&ep=${ep}`
    );

    if (!epQuery?.data?.anime?.episodes?.length && title) {
      const cleanTitle = title
        .replace(/\s*(season\s*\d+|part\s*\d+|\d+(?:st|nd|rd|th)\s*season).*/i, "")
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const searchRes = await queryWorker(`/api/anime/search?q=${encodeURIComponent(cleanTitle || title)}`);
      const results: any[] = searchRes?.data?.media ?? [];
      if (results.length > 0) {
        const best = results[0];
        const matchTitle = best.title?.english || best.title?.romaji || cleanTitle;
        epQuery = await queryWorker(
          `/api/anime/episodes?anilistId=${best.id}&animeTitle=${encodeURIComponent(matchTitle)}&ep=${ep}`
        );
      }
    }

    const anime = epQuery?.data?.anime;
    const episodes: any[] = anime?.episodes ?? [];
    const targetEp = episodes.find((e: any) => e.ep_no === ep) || episodes[ep - 1] || episodes[0];

    if (targetEp) {
      const serversObj = targetEp.servers ?? {};
      const candidateServers: any[] = serversObj[langKey] ?? serversObj.jap ?? serversObj.hindi ?? [];

      const subtitles: Array<{ url: string; lang: string }> = [];
      let downloadUrl: string | null = null;

      // Extract subtitles if available in targetEp
      const epSubs: any[] = targetEp.subtitles ?? [];
      for (const sub of epSubs) {
        const cleanLang = simplifySubtitleLabel(sub.label || sub.srcLang || "English");
        if (sub.url && !subtitles.some((x) => x.lang === cleanLang)) {
          subtitles.push({ url: sub.url, lang: cleanLang });
        }
      }

      // Build full Aniflix server list with authentic server names
      const aniflixServers: Array<{
        id: string;
        name: string;
        url: string;
        quality?: string;
        embedApi?: string;
        sourcesApi?: string;
      }> = candidateServers.map((s: any, idx: number) => {
        const serverName = s.server_alias || s.server_name || `Server ${idx + 1}`;
        const embedApi = s.embed_api || s.sources_api || s.link;
        return {
          id: `aniflix-${s.server_alias || idx}`,
          name: serverName,
          url: s.direct_embed_url || "",
          embedApi,
          sourcesApi: s.sources_api || s.raw_link,
          quality: "1080p",
        };
      });

      // Combine Aniflix servers with high-speed backup mirrors
      const allServerOptions: Array<{
        id: string;
        name: string;
        url: string;
        quality?: string;
        embedApi?: string;
        sourcesApi?: string;
      }> = [
        ...aniflixServers,
        ...fallbackEmbeds.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          quality: f.quality,
          embedApi: undefined,
          sourcesApi: undefined,
        })),
      ];

      // Pre-resolve Server 1 fast (under 2.5s)
      let initialEmbedUrl = fallbackEmbeds[0]?.url || "";
      const firstApi = allServerOptions[0]?.embedApi;
      if (firstApi) {
        try {
          const firstRes = await queryWorker(firstApi as string);
          if ((firstRes as any)?.data) {
            const d = (firstRes as any).data;
            const resolved =
              d.embedUrl ||
              d.rawEmbedUrl ||
              d.embeds?.[0]?.embedUrl ||
              d.embeds?.[0]?.frameUrl ||
              d.embeds?.[0]?.rawEmbedUrl;
            if (resolved && typeof resolved === "string" && resolved.startsWith("http")) {
              initialEmbedUrl = resolved;
              allServerOptions[0].url = resolved;
            }
          }
        } catch {
          // Use fallbackEmbeds[0]
        }
      } else if (allServerOptions[0]?.url) {
        initialEmbedUrl = allServerOptions[0].url;
      }

      const res: AnimeStreamResult = {
        success: true,
        provider: "Aniflix Multi-Worker Engine",
        tier: 2,
        directSources: [],
        subtitles,
        embedUrl: initialEmbedUrl,
        downloadUrl,
        fallbackEmbeds: allServerOptions,
      };

      streamCache.set(cacheKey, { data: res, expiresAt: now + CACHE_TTL_MS });
      return res;
    }
  } catch {
    // Fall back to mirrors
  }

  const result: AnimeStreamResult = {
    success: true,
    provider: "Embed Mirror Gateway",
    tier: 3,
    directSources: [],
    subtitles: [],
    embedUrl: fallbackEmbeds[0]?.url ?? "",
    fallbackEmbeds,
  };

  return result;
}

/**
 * On-demand server resolver for Aniflix servers.
 * Fast, non-blocking, with instant mirror fallback so it NEVER stays in an infinite loop.
 */
export async function resolveAnimeServerEmbed(
  server: { id: string; name: string; url?: string; embedApi?: string; sourcesApi?: string },
  anilistId: string | number,
  episodeNumber: number = 1,
  audioMode: "sub" | "dub" = "sub"
): Promise<string> {
  if (server.url && typeof server.url === "string" && server.url.startsWith("http")) {
    return server.url;
  }

  const cleanAniId = String(anilistId).replace("anime-", "").trim();
  const fallbackUrl = `https://vidsrc.me/embed/anime?anilist=${cleanAniId}&episode=${episodeNumber}`;
  const apiPath = server.embedApi || server.sourcesApi;
  if (!apiPath) return fallbackUrl;

  try {
    const res = await queryWorker(apiPath);
    if (res?.data) {
      const d = res.data;
      const resolved =
        d.embedUrl ||
        d.rawEmbedUrl ||
        d.embeds?.[0]?.embedUrl ||
        d.embeds?.[0]?.frameUrl ||
        d.embeds?.[0]?.rawEmbedUrl;
      if (resolved && typeof resolved === "string" && resolved.startsWith("http")) {
        server.url = resolved;
        return resolved;
      }
    }
  } catch {
    // Fallback immediately
  }

  return fallbackUrl;
}
