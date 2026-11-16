import { MediaType, PlayerServer } from "@/types/media";
import { getAnimeEmbedMirrors } from "@/lib/getAnimeStream";

export interface StreamSourceConfig {
  mediaType: MediaType;
  id: string | number;
  season?: number;
  episode?: number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number | null;
  audioMode?: "sub" | "dub";
  lang?: string;
  title?: string;
}

function isValidId(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return s !== "" && s !== "undefined" && s !== "null" && s !== "0";
}

/**
 * Builds the VidVault download page URL (360p / 720p / 1080p MKV) for Movies & TV.
 */
export function getVidVaultDownloadUrl(params: {
  mediaType: "movie" | "tv";
  tmdbId?: number;
  id: string | number;
  season?: number;
  episode?: number;
}): string {
  const targetId = params.tmdbId || (typeof params.id === "number" ? params.id : String(params.id));
  if (params.mediaType === "tv") {
    return `https://vidvault.to/tv/${targetId}/${params.season || 1}/${params.episode || 1}`;
  }
  return `https://vidvault.to/movie/${targetId}`;
}

/**
 * Returns embed server URLs using only domains confirmed reachable.
 * When a non-English audio language is selected (e.g. Hindi, Spanish, French),
 * multi-language servers (MultiEmbed with lang param) are dynamically prioritized.
 */
export function getPlayerServers(config: StreamSourceConfig): PlayerServer[] {
  const {
    mediaType,
    id,
    season = 1,
    episode = 1,
    tmdbId,
    anilistId,
    malId,
    audioMode = "sub",
    lang = "en",
    title,
  } = config;

  const targetId =
    tmdbId || (typeof id === "number" ? id : String(id).replace("anime-", ""));
  const cleanAniId =
    anilistId || (typeof id === "string" ? id.replace("anime-", "") : id);
  const cleanMalId = isValidId(malId) ? String(malId) : null;
  const primaryAnimeId = cleanMalId || cleanAniId;

  // Language label for display
  const langUpper = lang.toUpperCase();
  const isMultiLang = lang && lang !== "en";

  console.log('targetId:', targetId, 'tmdbId:', tmdbId, 'id:', id);

  // ── MOVIE ──────────────────────────────────────────────────────────
  if (mediaType === "movie") {
    return [
      { id: "s1", name: "Server 1", url: `https://vidrock.net/movie/${targetId}`, quality: "1080p", description: "VidRock Primary" },
      { id: "s2", name: "Server 2", url: `https://vidlink.pro/movie/${targetId}`, quality: "1080p", description: isMultiLang ? `VidLink (${langUpper})` : "VidLink Backup" },
      { id: "s3", name: "Server 3", url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1${isMultiLang ? `&lang=${lang}` : ""}`, quality: "HD", description: "MultiEmbed Fallback" },
    ];
  }

  // ── TV SHOWS ──────────────────────────────────────────────────────
  if (mediaType === "tv") {
    return [
      { id: "s1", name: "Server 1", url: `https://vidrock.net/tv/${targetId}/${season}/${episode}`, quality: "1080p", description: "VidRock Primary" },
      { id: "s2", name: "Server 2", url: `https://vidlink.pro/tv/${targetId}/${season}/${episode}`, quality: "1080p", description: isMultiLang ? `VidLink (${langUpper})` : "VidLink Backup" },
      { id: "s3", name: "Server 3", url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1&s=${season}&e=${episode}${isMultiLang ? `&lang=${lang}` : ""}`, quality: "HD", description: "MultiEmbed Fallback" },
    ];
  }

  // ── ANIME ─────────────────────────────────────────────────────────
  return getAnimeEmbedMirrors({
    anilistId: cleanAniId,
    malId: cleanMalId,
    episodeNumber: episode,
    audioMode,
    title: title || "",
  });}
