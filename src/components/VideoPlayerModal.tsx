"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Play,
  AlertTriangle,
} from "lucide-react";
import { MediaType, PlayerServer } from "@/types/media";
import { getPlayerServers } from "@/lib/playerSources";
import { getAnimeStream, resolveAnimeServerEmbed, AnimeStreamResult } from "@/lib/getAnimeStream";
import { useWatchlist } from "@/context/WatchlistContext";
import HlsVideoPlayer from "./HlsVideoPlayer";

interface VideoPlayerProps {
  mediaType: MediaType;
  id: string | number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number | null;
  audioMode?: "sub" | "dub";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  onEpisodeChange?: (season: number, episode: number) => void;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  mediaType,
  id,
  tmdbId,
  anilistId,
  malId,
  audioMode = "sub",
  title,
  posterPath,
  backdropPath,
  season = 1,
  episode = 1,
  episodeTitle,
  onEpisodeChange,
  autoPlay = false,
}: VideoPlayerProps) {
  const { updateContinueWatching } = useWatchlist();

  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [playerState, setPlayerState] = useState<"idle" | "loading" | "ready" | "error">(
    autoPlay ? "loading" : "idle"
  );
  const [animeStreamData, setAnimeStreamData] = useState<AnimeStreamResult | null>(null);
  const [resolvedUrlOverride, setResolvedUrlOverride] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(true);
  const [failedServers, setFailedServers] = useState<Set<number>>(new Set());
  const [useNativePlayer, setUseNativePlayer] = useState(false);

  const isFirstMountRef = useRef(true);
  const lastRecordedRef = useRef<string>("");
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
  };

  // Build base server list from playerSources
  const baseServers: PlayerServer[] = useMemo(
    () =>
      getPlayerServers({
        mediaType,
        id,
        tmdbId,
        anilistId,
        malId,
        audioMode,
        season,
        episode,
        title,
      }),
    [mediaType, id, tmdbId, anilistId, malId, audioMode, season, episode, title]
  );

  // For anime: resolve multi-worker stream data
  useEffect(() => {
    if (mediaType !== "anime") {
      setAnimeStreamData(null);
      setIsReady(true);
      return;
    }
    let mounted = true;

    getAnimeStream({
      anilistId: anilistId || id,
      malId: malId ?? null,
      title,
      episodeNumber: episode,
      audioMode,
    })
      .then((res) => {
        if (!mounted) return;
        setAnimeStreamData(res);
        setIsReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAnimeStreamData(null);
        setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [mediaType, id, anilistId, malId, title, episode, audioMode]);

  useEffect(() => {
    if (mediaType !== "anime") setIsReady(true);
  }, [mediaType]);

  // Reset on episode/server change
  useEffect(() => {
    clearTimer();
    setActiveServerIndex(0);
    setResolvedUrlOverride(null);
    setFailedServers(new Set());
    setIframeKey((k) => k + 1);
    setUseNativePlayer(false);

    const shouldPlay = isFirstMountRef.current ? autoPlay : true;
    isFirstMountRef.current = false;

    if (shouldPlay) {
      setPlayerState("loading");
      loadTimerRef.current = setTimeout(() => setPlayerState("ready"), 1200);
    } else {
      setPlayerState("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, season, episode, audioMode]);

  useEffect(() => () => clearTimer(), []);

  // Server list: preserve real server names (Itachi, Zoro, Rudeus, Nezuko, VidSrc, etc.)
  const allServers: PlayerServer[] = useMemo(() => {
    if (mediaType === "anime" && animeStreamData?.fallbackEmbeds?.length) {
      return animeStreamData.fallbackEmbeds.map((e, idx) => ({
        id: e.id || `srv-${idx}`,
        name: e.name || `Server ${idx + 1}`,
        url: e.url || "",
        quality: e.quality,
        embedApi: (e as any).embedApi,
        sourcesApi: (e as any).sourcesApi,
      }));
    }
    return baseServers;
  }, [mediaType, animeStreamData, baseServers]);

  const activeServer = allServers[activeServerIndex] || allServers[0] || null;
  const activeEmbedUrl =
    resolvedUrlOverride ||
    (activeServerIndex === 0 && animeStreamData?.embedUrl
      ? animeStreamData.embedUrl
      : activeServer?.url || "");

  // Direct media streams (HLS .m3u8 or MP4)
  const directStreamSource = useMemo(() => {
    if (mediaType === "anime" && animeStreamData?.directSources?.length) {
      return animeStreamData.directSources[0];
    }
    return null;
  }, [mediaType, animeStreamData]);

  // Continue watching record
  useEffect(() => {
    if (!id || !title) return;
    const key = `${id}-${season}-${episode}`;
    if (lastRecordedRef.current === key) return;
    lastRecordedRef.current = key;
    updateContinueWatching({
      id,
      mediaType,
      title,
      posterPath,
      backdropPath,
      seasonNumber: mediaType === "movie" ? undefined : season,
      episodeNumber: mediaType === "movie" ? undefined : episode,
      episodeTitle,
      progressPercent: 50,
      timestamp: Date.now(),
    });
  }, [id, title, mediaType, posterPath, backdropPath, season, episode, episodeTitle, updateContinueWatching]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!activeServer) return;
    clearTimer();
    setUseNativePlayer(false);
    setPlayerState("loading");
    loadTimerRef.current = setTimeout(() => setPlayerState("ready"), 800);
  }, [activeServer]);

  const switchServer = useCallback(
    async (index: number) => {
      clearTimer();
      setUseNativePlayer(false);
      setActiveServerIndex(index);
      setPlayerState("loading");
      loadTimerRef.current = setTimeout(() => setPlayerState("ready"), 1000);

      const srv = allServers[index];
      if (srv) {
        if (srv.url && srv.url.startsWith("http")) {
          setResolvedUrlOverride(srv.url);
          setIframeKey((k) => k + 1);
        } else if (mediaType === "anime") {
          try {
            const resolved = await resolveAnimeServerEmbed(
              srv,
              anilistId || id,
              episode,
              audioMode
            );
            setResolvedUrlOverride(resolved);
            setIframeKey((k) => k + 1);
          } catch {
            setIframeKey((k) => k + 1);
          }
        }
      }
    },
    [allServers, mediaType, anilistId, id, episode, audioMode]
  );

  const handleServerSelect = useCallback(
    (index: number) => {
      switchServer(index);
    },
    [switchServer]
  );

  const handleNextServer = useCallback(() => {
    const total = allServers.length;
    let next = (activeServerIndex + 1) % total;
    let tries = 0;
    while (failedServers.has(next) && tries < total) {
      next = (next + 1) % total;
      tries++;
    }
    switchServer(next);
  }, [activeServerIndex, allServers.length, failedServers, switchServer]);

  const handleIframeLoad = useCallback(() => {
    clearTimer();
    setPlayerState("ready");
  }, []);

  const handleIframeError = useCallback(() => {
    clearTimer();
    setPlayerState("error");
    setFailedServers((prev) => new Set(prev).add(activeServerIndex));
  }, [activeServerIndex]);

  const handleOpenExternal = useCallback(() => {
    if (!activeEmbedUrl) return;
    window.open(activeEmbedUrl, "_blank", "noopener,noreferrer");
  }, [activeEmbedUrl]);

  const handleNativeError = useCallback(() => {
    // Seamless fallback to active embed server
    setUseNativePlayer(false);
  }, []);

  const handleFullscreenChange = useCallback(async (isFullscreen: boolean) => {
    // Auto screen orientation unlock / lock to landscape on mobile
    if (typeof window !== "undefined" && window.screen && "orientation" in window.screen) {
      const screenOri = (window.screen as any).orientation;
      if (screenOri && typeof screenOri.lock === "function") {
        try {
          if (isFullscreen) {
            await screenOri.lock("landscape");
          } else if (typeof screenOri.unlock === "function") {
            screenOri.unlock();
          }
        } catch {
          // Ignored if browser requires user gesture or doesn't support orientation lock
        }
      }
    }
  }, []);

  const poster = backdropPath || posterPath;
  const displayTitle = mediaType === "movie" ? title : `${title} — Ep ${episode}`;

  // Whether we should render the high-end custom HlsVideoPlayer
  const showNativeHls =
    playerState !== "idle" &&
    useNativePlayer &&
    mediaType === "anime" &&
    directStreamSource !== null &&
    Boolean(directStreamSource?.url);

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* ── SERVER TABS ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap px-0.5">
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mr-0.5 hidden xs:inline">
          Server
        </span>

        {allServers.map((srv, idx) => {
          const isActive = activeServerIndex === idx;
          const failed = failedServers.has(idx);
          return (
            <button
              key={srv.id}
              onClick={() => handleServerSelect(idx)}
              className={[
                "relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none active:scale-95",
                isActive && !failed
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 font-bold"
                  : failed
                  ? "bg-red-500/10 text-red-400/50 border border-red-500/20 line-through"
                  : "bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white border border-white/[0.04]",
              ].join(" ")}
            >
              {srv.name}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => handleServerSelect(activeServerIndex)}
            title="Reload current server"
            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/70 transition-all border border-white/[0.04]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {allServers.length > 1 && (
            <button
              onClick={handleNextServer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white text-xs font-semibold transition-all border border-white/[0.04]"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleOpenExternal}
            title="Open in external clean tab"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Open</span>
          </button>
        </div>
      </div>

      {/* ── PLAYER CANVAS ──────────────────────────────────────────────── */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#07080d] border border-white/[0.05] shadow-2xl shadow-black/60">
        {/* NATIVE HIGH-END HLS VIDEO PLAYER */}
        {showNativeHls ? (
          <HlsVideoPlayer
            key={`native-${episode}-${directStreamSource.url}`}
            src={directStreamSource.url}
            poster={poster}
            title={displayTitle}
            subtitles={animeStreamData?.subtitles || []}
            introSkip={animeStreamData?.intro}
            outroSkip={animeStreamData?.outro}
            onError={handleNativeError}
            onFullscreenChange={handleFullscreenChange}
          />
        ) : (
          <>
            {/* IDLE: Poster + Big Play Button */}
            {playerState === "idle" && (
              <button
                onClick={handlePlay}
                disabled={!isReady}
                className="absolute inset-0 w-full h-full group transition-all duration-300"
                aria-label={`Play ${displayTitle}`}
              >
                {poster ? (
                  <img
                    src={poster}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0f1118] to-[#1a1d2e]" />
                )}
                <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors duration-300" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div
                    className={[
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-white/30 bg-white/10",
                      "flex items-center justify-center backdrop-blur-sm",
                      "group-hover:scale-110 group-hover:bg-emerald-500/30 group-hover:border-emerald-400/60",
                      "transition-all duration-300 shadow-2xl shadow-black/40",
                      !isReady ? "opacity-40 cursor-wait" : "",
                    ].join(" ")}
                  >
                    {isReady ? (
                      <Play className="w-7 h-7 sm:w-9 sm:h-9 text-white fill-white ml-1 drop-shadow-lg" />
                    ) : (
                      <RefreshCw className="w-6 h-6 text-white/60 animate-spin" />
                    )}
                  </div>
                  <div className="text-center px-4">
                    <p className="text-white font-semibold text-sm sm:text-base drop-shadow-md line-clamp-1">
                      {displayTitle}
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                      {isReady ? `Tap to play · ${activeServer?.name}` : "Connecting to high-speed servers…"}
                    </p>
                  </div>
                </div>
                {isReady && activeServer && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 border border-white/10 text-[11px] text-white/60 font-medium backdrop-blur-sm">
                    {activeServer.name}
                  </div>
                )}
              </button>
            )}

            {/* LOADING: sleek spinner */}
            {playerState === "loading" && (
              <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-[2px] animate-fade-in">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <p className="text-white/70 text-xs font-medium tracking-wide">
                  {activeServer?.name} — connecting…
                </p>
              </div>
            )}

            {/* ERROR */}
            {playerState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#07080d]/95 p-6 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-orange-400" />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-semibold mb-1">
                    {activeServer?.name} stream unavailable
                  </p>
                  <p className="text-white/40 text-xs max-w-xs">
                    Switching to alternative server. If all servers fail, this episode may not have aired or uploaded yet.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleNextServer}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors shadow-lg shadow-emerald-600/30"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Try Next Server
                  </button>
                  <button
                    onClick={() => handleServerSelect(activeServerIndex)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white text-sm font-medium transition-colors border border-white/[0.06]"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* IFRAME: persistent mount without destructive false-positive unmounting */}
            {isReady && activeServer && (
              <iframe
                key={`player-frame-${iframeKey}-${activeServerIndex}-${episode}`}
                src={activeEmbedUrl}
                title={displayTitle}
                className="absolute inset-0 w-full h-full border-0 z-10"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={handleIframeLoad}
              />
            )}
          </>
        )}
      </div>

      {/* ── STATUS LINE ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-white/20 font-medium">
          {showNativeHls
            ? `▶ Direct HLS Stream Active`
            : playerState === "ready"
            ? `▶ ${activeServer?.name}`
            : playerState === "loading"
            ? `◌ Connecting to ${activeServer?.name}…`
            : playerState === "error"
            ? `✗ ${activeServer?.name} failed`
            : isReady
            ? `Tap ▶ to play on ${activeServer?.name}`
            : "Locating high-speed streams…"}
        </p>
        {failedServers.size > 0 && (
          <p className="text-[11px] text-orange-400/40">{failedServers.size} failed</p>
        )}
      </div>
    </div>
  );
}
