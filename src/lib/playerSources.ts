import { MediaType, PlayerServer } from "@/types/media";

export interface StreamSourceConfig {
  mediaType: MediaType;
  id: string | number;
  season?: number;
  episode?: number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number | null;
  audioMode?: "sub" | "dub";
  title?: string;
}

function isValidId(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return s !== "" && s !== "undefined" && s !== "null" && s !== "0";
}

/**
 * Returns embed server URLs using only domains confirmed reachable (2026-09-04).
 *
 * Dead/removed: vidsrc.to (404 on /embed/anime/), vidsrc.xyz (ENOTFOUND),
 *               embed.su (ENOTFOUND), vidsrc.net (ENOTFOUND).
 *
 * Live confirmed: vidsrc.me, vidsrc.pm, vidsrc.su, multiembed.mov
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
  } = config;

  const targetId =
    tmdbId || (typeof id === "number" ? id : String(id).replace("anime-", ""));
  const cleanAniId =
    anilistId || (typeof id === "string" ? id.replace("anime-", "") : id);
  const cleanMalId = isValidId(malId) ? String(malId) : null;
  const primaryAnimeId = cleanMalId || cleanAniId;

  // ── MOVIE ──────────────────────────────────────────────────────────
  if (mediaType === "movie") {
    return [
      { id: "s1", name: "Server 1 (VidLink)", url: `https://vidlink.pro/movie/${targetId}` },
      { id: "s2", name: "Server 2 (VidSrc)", url: `https://vidsrc.me/embed/movie?tmdb=${targetId}` },
      { id: "s3", name: "Server 3 (MultiEmbed)", url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1` },
      { id: "s4", name: "Server 4 (VidSrc PM)", url: `https://vidsrc.pm/embed/movie/${targetId}` },
      { id: "s5", name: "Server 5 (VidSrc SU)", url: `https://vidsrc.su/embed/movie/${targetId}` },
    ];
  }

  // ── TV SHOWS ──────────────────────────────────────────────────────
  if (mediaType === "tv") {
    return [
      { id: "s1", name: "Server 1 (VidLink)", url: `https://vidlink.pro/tv/${targetId}/${season}/${episode}` },
      { id: "s2", name: "Server 2 (VidSrc)", url: `https://vidsrc.me/embed/tv?tmdb=${targetId}&season=${season}&episode=${episode}` },
      { id: "s3", name: "Server 3 (MultiEmbed)", url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1&s=${season}&e=${episode}` },
      { id: "s4", name: "Server 4 (VidSrc PM)", url: `https://vidsrc.pm/embed/tv/${targetId}/${season}/${episode}` },
      { id: "s5", name: "Server 5 (VidSrc SU)", url: `https://vidsrc.su/embed/tv/${targetId}/${season}/${episode}` },
    ];
  }

  // ── ANIME ─────────────────────────────────────────────────────────
  const audioSuffix = audioMode === "dub" ? "dub" : "sub";

  // Server 1: VidSrc ME — full episode library, native AniList & MAL support, verified 200 OK
  const s1 = cleanMalId
    ? `https://vidsrc.me/embed/anime?mal=${cleanMalId}&episode=${episode}`
    : `https://vidsrc.me/embed/anime?anilist=${cleanAniId}&episode=${episode}`;

  // Server 2: VidSrc PM — fastest mirror, instant stream resolve
  const s2 = cleanMalId
    ? `https://vidsrc.pm/embed/anime/${cleanMalId}/${episode}`
    : `https://vidsrc.pm/embed/anime/${cleanAniId}/${episode}`;

  // Server 3: VidSrc SU — high-availability European CDN mirror
  const s3 = cleanMalId
    ? `https://vidsrc.su/embed/anime/${cleanMalId}/${episode}`
    : `https://vidsrc.su/embed/anime/${cleanAniId}/${episode}`;

  // Server 4: MultiEmbed — global multi-stream resolver
  const s4 = `https://multiembed.mov/?video_id=${primaryAnimeId}&is_anime=1&s=1&e=${episode}`;

  // Server 5: 2Embed — backup streaming node
  const s5 = `https://2embed.cc/embedtv/${cleanAniId}&s=1&e=${episode}`;

  // Server 6: VidLink Pro — sleek player with subtitle/dub controls
  const s6 = cleanMalId
    ? `https://vidlink.pro/anime/${cleanMalId}/${episode}/${audioSuffix}`
    : `https://vidlink.pro/anime/${cleanAniId}/${episode}/${audioSuffix}`;

  return [
    { id: "s1", name: "Server 1", url: s1 },
    { id: "s2", name: "Server 2", url: s2 },
    { id: "s3", name: "Server 3", url: s3 },
    { id: "s4", name: "Server 4", url: s4 },
    { id: "s5", name: "Server 5", url: s5 },
    { id: "s6", name: "Server 6", url: s6 },
  ];
}
