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
  lang?: string;
  title?: string;
}

function isValidId(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return s !== "" && s !== "undefined" && s !== "null" && s !== "0";
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

  // ── MOVIE ──────────────────────────────────────────────────────────
  if (mediaType === "movie") {
    if (isMultiLang) {
      return [
        { id: "s-multi1", name: `Server 1 (${langUpper} HD)`, url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1&lang=${lang}` },
        { id: "s-multi2", name: `Server 2 (${langUpper})`, url: `https://2embed.cc/embed/${targetId}` },
        { id: "s-multi3", name: "Server 3 (VidLink)", url: `https://vidlink.pro/movie/${targetId}` },
        { id: "s-multi4", name: "Server 4 (VidSrc)", url: `https://vidsrc.me/embed/movie?tmdb=${targetId}` },
      ];
    }

    return [
      { id: "s1", name: "Server 1 (HD)", url: `https://vaplayer.ru/embed/movie/${targetId}` },
      { id: "s2", name: "Server 2 (VidLink)", url: `https://vidlink.pro/movie/${targetId}` },
      { id: "s3", name: "Server 3 (VidSrc)", url: `https://vidsrc.me/embed/movie?tmdb=${targetId}` },
    ];
  }

  // ── TV SHOWS ──────────────────────────────────────────────────────
  if (mediaType === "tv") {
    if (isMultiLang) {
      return [
        { id: "s-multi1", name: `Server 1 (${langUpper} HD)`, url: `https://multiembed.mov/?video_id=${targetId}&tmdb=1&s=${season}&e=${episode}&lang=${lang}` },
        { id: "s-multi2", name: `Server 2 (${langUpper})`, url: `https://2embed.cc/embedtv/${targetId}&s=${season}&e=${episode}` },
        { id: "s-multi3", name: "Server 3 (VidLink)", url: `https://vidlink.pro/tv/${targetId}/${season}/${episode}` },
        { id: "s-multi4", name: "Server 4 (VidSrc)", url: `https://vidsrc.me/embed/tv?tmdb=${targetId}&season=${season}&episode=${episode}` },
      ];
    }

    return [
      { id: "s1", name: "Server 1 (HD)", url: `https://vaplayer.ru/embed/tv/${targetId}/${season}/${episode}` },
      { id: "s2", name: "Server 2 (VidLink)", url: `https://vidlink.pro/tv/${targetId}/${season}/${episode}` },
      { id: "s3", name: "Server 3 (VidSrc)", url: `https://vidsrc.me/embed/tv?tmdb=${targetId}&season=${season}&episode=${episode}` },
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
