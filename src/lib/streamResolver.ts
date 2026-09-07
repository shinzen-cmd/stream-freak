/**
 * Unified Stream Resolver Types & Client Helper
 * Resolves direct HLS (.m3u8) and MP4 streams through the Stream Freak Edge Proxy.
 */

export interface ResolveStreamParams {
  mediaType: "movie" | "tv" | "anime";
  id: string | number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number | null;
  season?: number;
  episode?: number;
  audioMode?: "sub" | "dub";
  lang?: string;
  title?: string;
}

export interface StreamAudioTrack {
  id: string;
  label: string;
  lang: string;
  isDefault?: boolean;
  streamUrl?: string;
}

export interface StreamSubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

export interface ResolvedDirectStreamResult {
  success: boolean;
  streamUrl: string | null;
  rawUrl?: string | null;
  type: "hls" | "mp4";
  quality?: string;
  audioTracks: StreamAudioTrack[];
  subtitles: StreamSubtitleTrack[];
  provider?: string;
  fallbackEmbedUrl?: string;
  error?: string;
}

/**
 * Fetch a direct HLS / MP4 stream from the Stream Freak Edge Proxy Resolver.
 */
export async function fetchDirectStream(
  params: ResolveStreamParams
): Promise<ResolvedDirectStreamResult> {
  const query = new URLSearchParams();
  query.set("mediaType", params.mediaType);
  query.set("id", String(params.id));
  if (params.tmdbId) query.set("tmdbId", String(params.tmdbId));
  if (params.anilistId) query.set("anilistId", String(params.anilistId));
  if (params.malId) query.set("malId", String(params.malId));
  if (params.season) query.set("season", String(params.season));
  if (params.episode) query.set("episode", String(params.episode));
  if (params.audioMode) query.set("audioMode", params.audioMode);
  if (params.lang) query.set("lang", params.lang);
  if (params.title) query.set("title", params.title);

  try {
    const res = await fetch(`/api/stream/resolve?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Resolver API returned HTTP ${res.status}`);
    }

    const data: ResolvedDirectStreamResult = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      streamUrl: null,
      type: "hls",
      audioTracks: [],
      subtitles: [],
      error: err?.message || "Failed to contact stream resolver API",
    };
  }
}
