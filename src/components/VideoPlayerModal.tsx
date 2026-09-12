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
  ShieldCheck,
} from "lucide-react";
import { MediaType, PlayerServer } from "@/types/media";
import { getPlayerServers } from "@/lib/playerSources";
import { getAnimeStream, resolveAnimeServerEmbed, AnimeStreamResult } from "@/lib/getAnimeStream";
import { useWatchlist } from "@/context/WatchlistContext";
import { fetchDirectStream, StreamAudioTrack } from "@/lib/streamResolver";
import HlsVideoPlayer from "./HlsVideoPlayer";
import OverlayAdBlocker from "./OverlayAdBlocker";
import { attachStreamInterceptor } from "@/lib/streamInterceptor";

const SESSION_LOCKED_HOSTS = [
  "megavid.buzz",
  "cp.megavid.buzz",
  "zorotv.ba",
  "api-webs.com",
  "cdn.api-webs.com",
  "vidlink.pro",
  "vidsrc.cc",
];


interface VideoPlayerProps {
  mediaType: MediaType;
  id: string | number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number | null;
  audioMode?: "sub" | "dub";
  selectedLang?: string;
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
  selectedLang = "en",
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
  const [savedPlaybackTime, setSavedPlaybackTime] = useState<number>(0);

  const [animeStreamData, setAnimeStreamData] = useState<AnimeStreamResult | null>(null);
  const [resolvedUrlOverride, setResolvedUrlOverride] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(true);
  const [failedServers, setFailedServers] = useState<Set<number>>(new Set());
  const [useNativePlayer, setUseNativePlayer] = useState(false);
  const [useNativeEmbed, setUseNativeEmbed] = useState(false);
  const [extractedStreamUrl, setExtractedStreamUrl] = useState<string | null>(null);
  const [extractedSubtitles, setExtractedSubtitles] = useState<Array<{ url: string; lang: string }>>([]);
  const [extractedAudioTracks, setExtractedAudioTracks] = useState<StreamAudioTrack[]>([]);
  const [isResolvingStream, setIsResolvingStream] = useState(false);

  const isFirstMountRef = useRef(true);
  const lastRecordedRef = useRef<string>("");
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptedResolveRef = useRef<string>("");

  const clearTimer = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin.includes("vidlink.pro")) {
        if (event.data?.type === 'MEDIA_DATA') {
          console.log('MEDIA_DATA:', JSON.stringify(event.data.data));
          // @ts-ignore
          window._vidlinkData = event.data.data;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  // Build base server list from playerSources with active multi-language routing
  const baseServers: PlayerServer[] = useMemo(
    () =>
      getPlayerServers({
        mediaType,
        id,
        tmdbId,
        anilistId,
        malId,
        audioMode,
        lang: selectedLang,
        season,
        episode,
        title,
      }),
    [mediaType, id, tmdbId, anilistId, malId, audioMode, selectedLang, season, episode, title]
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
        setAnimeStreamData((prev) => {
          if (prev?.directSources?.length && (!res || !res.directSources || res.directSources.length === 0)) {
            return {
              ...res,
              directSources: prev.directSources,
              provider: prev.provider,
            };
          }
          return res;
        });
        setIsReady(true);
        if (res && res.directSources && res.directSources.length > 0) {
          setUseNativePlayer(true);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [mediaType, id, anilistId, malId, title, episode, audioMode]);

  useEffect(() => {
    if (mediaType !== "anime") setIsReady(true);
  }, [mediaType]);

  // Reset on episode/server/language change
  useEffect(() => {
    clearTimer();
    setActiveServerIndex(0);
    setResolvedUrlOverride(null);
    setFailedServers(new Set());
    setIframeKey((k) => k + 1);
    setUseNativePlayer(false);
    setUseNativeEmbed(false);
    setExtractedStreamUrl(null);
    setExtractedAudioTracks([]);

    const shouldPlay = isFirstMountRef.current ? autoPlay : true;
    isFirstMountRef.current = false;

    if (shouldPlay) {
      setPlayerState("loading");
      loadTimerRef.current = setTimeout(() => setPlayerState("ready"), 1200);
    } else {
      setPlayerState("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, season, episode, audioMode, selectedLang]);

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

  const currentServerUrl = activeEmbedUrl;

  // Direct media streams (HLS .m3u8 or MP4)
  const directStreamSource = useMemo(() => {
    // When useNativeEmbed is true, direct stream is disabled
    if (useNativeEmbed) return null;

    // 1. Prefer verified extractedStreamUrl (which has referers & proxied M3U8 configured)
    if (extractedStreamUrl) {
      const isProxied = extractedStreamUrl.startsWith("/api/proxy/stream");
      const isLocked =
        !isProxied &&
        SESSION_LOCKED_HOSTS.some((h) => extractedStreamUrl.toLowerCase().includes(h));
      if (!isLocked) {
        return {
          url: extractedStreamUrl,
          quality: "Auto",
          isM3U8: extractedStreamUrl.includes(".m3u8"),
          type: (extractedStreamUrl.includes(".mp4") ? "mp4" : "hls") as "hls" | "mp4",
        };
      }
    }
    // 2. Direct sources from anime resolver (proxied through stream proxy to bypass CORS/hotlink protection)
    if (mediaType === "anime" && animeStreamData?.directSources?.length) {
      const raw = animeStreamData.directSources[0];
      const isLocked = SESSION_LOCKED_HOSTS.some((h) =>
        raw.url.toLowerCase().includes(h)
      );
      if (!isLocked) {
        const proxiedUrl = raw.url.startsWith("/api/proxy/stream")
          ? raw.url
          : `/api/proxy/stream?url=${encodeURIComponent(raw.url)}&referer=${encodeURIComponent("https://zorotv.ba/")}`;
        return {
          ...raw,
          url: proxiedUrl,
        };
      }
    }
    return null;
  }, [mediaType, animeStreamData, extractedStreamUrl, useNativeEmbed]);

  const effectiveSubtitles = useMemo(() => {
    if (animeStreamData?.subtitles?.length) {
      return animeStreamData.subtitles;
    }
    return extractedSubtitles;
  }, [animeStreamData?.subtitles, extractedSubtitles]);

  // Attempt ad-free direct stream extraction via Phase 1 Unified Stream Resolver
  const resolveStream = useCallback(async () => {
    setIsResolvingStream(true);
    try {
      const data = await fetchDirectStream({
        mediaType,
        id,
        tmdbId,
        anilistId,
        malId,
        season,
        episode,
        audioMode,
        lang: selectedLang,
        title,
      });

      if (data.success && data.streamUrl && !data.useNativeEmbed) {
        const isLocked = SESSION_LOCKED_HOSTS.some((h) =>
          data.streamUrl?.toLowerCase().includes(h)
        );
        if (!isLocked) {
          setExtractedStreamUrl(data.streamUrl);
          setExtractedSubtitles(data.subtitles || []);
          setExtractedAudioTracks(data.audioTracks || []);
          setUseNativePlayer(true);
          setUseNativeEmbed(false);
          setIsResolvingStream(false);
          return true;
        }
      }

      if (data.useNativeEmbed || data.embedUrl || data.fallbackEmbedUrl) {
        setUseNativeEmbed(true);
        setUseNativePlayer(false);
        setExtractedStreamUrl(null);
        if (data.embedUrl || data.fallbackEmbedUrl) {
          setResolvedUrlOverride(data.embedUrl || data.fallbackEmbedUrl || null);
        }
        setIsResolvingStream(false);
        return true;
      }
    } catch {
      // Fallback to overlay ad-blocker embed
    }
    setExtractedStreamUrl(null);
    setUseNativePlayer(false);
    setUseNativeEmbed(true);
    setIsResolvingStream(false);
    return false;
  }, [mediaType, id, tmdbId, anilistId, malId, season, episode, audioMode, selectedLang, title]);

  // When selectedLang or audioMode changes on an active player, re-resolve stream with timestamp preserved
  useEffect(() => {
    if (playerState !== "idle" && (selectedLang || audioMode)) {
      attemptedResolveRef.current = `${id}-${season}-${episode}-${audioMode}-${selectedLang}`;
      resolveStream();
    }
  }, [selectedLang, audioMode, resolveStream, id, season, episode]);

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

  // Auto-resolve stream when player is active (guarded against duplicate/infinite retry loops)
  useEffect(() => {
    const currentKey = `${id}-${season}-${episode}-${audioMode}-${selectedLang}`;
    if (
      playerState !== "idle" &&
      !directStreamSource &&
      !isResolvingStream &&
      attemptedResolveRef.current !== currentKey
    ) {
      attemptedResolveRef.current = currentKey;
      resolveStream().then((success) => {
        if (success) setUseNativePlayer(true);
      });
    }
  }, [playerState, directStreamSource, isResolvingStream, resolveStream, id, season, episode, audioMode, selectedLang]);

  // ── NetflixAPI-inspired Stream Interceptor ──────────────────────────────────
  // Listen for handshake network requests, iframe messages, and resource timings
  // to feed the active session-tokenized stream into HlsVideoPlayer
  useEffect(() => {
    if (!currentServerUrl || useNativePlayer) return;

    const cleanup = attachStreamInterceptor(currentServerUrl, (result) => {
      if (result?.streamUrl) {
        setExtractedStreamUrl(result.streamUrl);
        setUseNativePlayer(true);
        setUseNativeEmbed(false);
        setPlayerState("ready");
      }
    });

    return cleanup;
  }, [currentServerUrl, useNativePlayer]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePlay = useCallback(async () => {
    clearTimer();
    setPlayerState("loading");

    if (directStreamSource?.url) {
      setUseNativePlayer(true);
      setPlayerState("ready");
      return;
    }

    const success = await resolveStream();
    if (success) {
      setUseNativePlayer(true);
    } else {
      setUseNativePlayer(false);
    }
    setPlayerState("ready");
  }, [directStreamSource, resolveStream]);

  const switchServer = useCallback(
    async (index: number) => {
      clearTimer();
      setUseNativePlayer(false);
      setActiveServerIndex(index);
      setPlayerState("loading");

      const srv = allServers[index];
      let targetUrl = srv?.url || "";

      if (srv) {
        if (srv.url && srv.url.startsWith("http")) {
          setResolvedUrlOverride(srv.url);
          setIframeKey((k) => k + 1);
          targetUrl = srv.url;
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
            targetUrl = resolved;
          } catch {
            setIframeKey((k) => k + 1);
          }
        }
      }
      // Check with hybrid resolution API for the target embed URL
      if (targetUrl) {
        try {
          const res = await fetch(`/api/resolve?url=${encodeURIComponent(targetUrl)}`);
          if (res.ok) {
            const resolvedData = await res.json();
            const isLocked = SESSION_LOCKED_HOSTS.some((h) =>
              (resolvedData.streamUrl || "").toLowerCase().includes(h) ||
              targetUrl.toLowerCase().includes(h)
            );

            if (resolvedData.streamUrl && !resolvedData.useNativeEmbed && !isLocked) {
              setExtractedStreamUrl(resolvedData.streamUrl);
              setUseNativePlayer(true);
              setUseNativeEmbed(false);
              setPlayerState("ready");
              return;
            } else if (resolvedData.useNativeEmbed || isLocked) {
              if (resolvedData.embedUrl) setResolvedUrlOverride(resolvedData.embedUrl);
              setUseNativePlayer(false);
              setUseNativeEmbed(true);
              setExtractedStreamUrl(null);
            }
          }
        } catch {
          // Fallback to overlay ad-blocker embed
        }
      }

      loadTimerRef.current = setTimeout(() => setPlayerState("ready"), 600);
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

  // Hardened popup & ad suppression from third-party embed mirrors without triggering anti-sandbox blockers
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalOpen = window.open;

    // Neutralize unauthorized popup tabs
    window.open = function (url?: string | URL, target?: string, features?: string) {
      const urlStr = url ? String(url) : "";
      if (
        urlStr.startsWith("blob:") ||
        urlStr.includes("/api/") ||
        urlStr.includes("streamfreak") ||
        urlStr.includes("aniflix")
      ) {
        return originalOpen.call(window, url, target, features);
      }
      // Silently discard third-party ad popups
      return null;
    };

    // Block rogue programmatic clicks on injected ad links
    const handleDocClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (target && target.href) {
        const href = target.href;
        const isInternal =
          href.startsWith(window.location.origin) ||
          href.startsWith("blob:") ||
          href.includes("/api/");
        if (!isInternal && target.target === "_blank") {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener("click", handleDocClick, true);

    return () => {
      window.open = originalOpen;
      window.removeEventListener("click", handleDocClick, true);
    };
  }, []);

  const poster = backdropPath || posterPath;
  const displayTitle = mediaType === "movie" ? title : `${title} — Ep ${episode}`;

  const cleanStreamUrl =
    directStreamSource?.url ||
    (extractedStreamUrl && extractedStreamUrl.startsWith("/api/proxy/stream") ? extractedStreamUrl : "");

  // Render HlsVideoPlayer ONLY when a clean, non-locked stream URL is resolved
  // Proxied streams (/api/proxy/stream) mirror the captured session context and are safe
  const isCleanStream =
    Boolean(cleanStreamUrl) &&
    (cleanStreamUrl.startsWith("/api/proxy/stream") ||
      !SESSION_LOCKED_HOSTS.some((h) => cleanStreamUrl.toLowerCase().includes(h)));

  // Whether we should render the high-end custom HlsVideoPlayer
  const showNativeHls =
    playerState !== "idle" &&
    useNativePlayer &&
    !useNativeEmbed &&
    isCleanStream;

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* ── SERVER TABS & STREAM MODE ───────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap px-0.5">
        {/* Stream Mode Badge & Mirror Switcher */}
        <div className="flex items-center gap-1.5 mr-1">
          {showNativeHls ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ⚡ Native Player (Ad-Free)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              🛡️ Ad Shield Active
            </span>
          )}
          {cleanStreamUrl && (
            <button
              onClick={() => {
                setUseNativePlayer((p) => !p);
                setUseNativeEmbed((e) => !e);
              }}
              className="text-[11px] text-white/40 hover:text-white underline underline-offset-2 ml-0.5 transition"
              title={showNativeHls ? "Switch to Embed Mirror" : "Switch to Direct Ad-Free Player"}
            >
              {showNativeHls ? "Mirror" : "Direct"}
            </button>
          )}
        </div>

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
            key={`native-${episode}-${cleanStreamUrl}`}
            src={cleanStreamUrl}
            poster={poster}
            initialTime={savedPlaybackTime}
            title={displayTitle}
            subtitles={effectiveSubtitles}
            audioTracks={extractedAudioTracks}
            introSkip={animeStreamData?.intro}
            outroSkip={animeStreamData?.outro}
            onTimeUpdate={(t) => setSavedPlaybackTime(t)}
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

            {/* OVERLAY AD-BLOCKER: Unsandboxed iframe + click shield for session-locked / embed hosts */}
            {isReady && activeServer && (
              <OverlayAdBlocker
                key={`player-frame-${iframeKey}-${activeServerIndex}-${episode}-${selectedLang}`}
                embedUrl={currentServerUrl}
                title={displayTitle}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}
          </>
        )}
      </div>

      {/* ── STATUS LINE ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-white/20 font-medium">
          {showNativeHls
            ? `▶ Direct Ad-Free Stream Active (${activeServer?.name || "Server"})`
            : isResolvingStream || playerState === "loading"
            ? `◌ Connecting to ${activeServer?.name}…`
            : playerState === "ready"
            ? `▶ ${activeServer?.name}`
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
