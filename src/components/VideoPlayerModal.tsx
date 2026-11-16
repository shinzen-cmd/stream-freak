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
  ChevronDown,
  Play,
  AlertTriangle,
  ShieldCheck,
  Layers,
  X,
  Lock,
  Cloud,
  Languages,
} from "lucide-react";
import { MediaType, PlayerServer } from "@/types/media";
import { getPlayerServers } from "@/lib/playerSources";
import { getAnimeStream, resolveAnimeServerEmbed, AnimeStreamResult } from "@/lib/getAnimeStream";
import { useWatchlist } from "@/context/WatchlistContext";
import { useAuth } from "@/context/AuthContext";
import { fetchDirectStream, StreamAudioTrack } from "@/lib/streamResolver";
import HlsVideoPlayer from "./HlsVideoPlayer";
import OverlayAdBlocker from "./OverlayAdBlocker";
import { attachStreamInterceptor } from "@/lib/streamInterceptor";
import LottieErrorAnimation from "@/components/animations/LottieErrorAnimation";

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
  totalEpisodes?: number;
  onLangCycle?: () => void;
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
  totalEpisodes,
  onLangCycle,
  autoPlay = false,
}: VideoPlayerProps) {
  const { updateContinueWatching } = useWatchlist();
  const { canAccessMemberFeatures, openAuthGate } = useAuth();

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
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isFirstMountRef = useRef(true);
  const lastRecordedRef = useRef<string>("");
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptedResolveRef = useRef<string>("");

  const clearTimer = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
  };

  // Close server dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isDropdownOpen]);

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
        category: (e as any).category || "Shadow Army",
        description: (e as any).description || "Ad-Free Server",
        badge: (e as any).badge || "HD",
        embedApi: (e as any).embedApi,
        sourcesApi: (e as any).sourcesApi,
      }));
    }
    return baseServers;
  }, [mediaType, animeStreamData, baseServers]);

  const activeServer = allServers[activeServerIndex] || allServers[0] || null;
  const rawEmbedUrl =
    resolvedUrlOverride ||
    (activeServerIndex === 0 && animeStreamData?.embedUrl
      ? animeStreamData.embedUrl
      : activeServer?.url || "");

  // Gate Auto-Skip for mobile/web guests (unlocked on TV and signed-in accounts)
  const activeEmbedUrl =
    !canAccessMemberFeatures && rawEmbedUrl.startsWith("https://zokoanime.video/")
      ? rawEmbedUrl.replace("asi=1", "asi=0")
      : rawEmbedUrl;

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
      if (index > 0 && !canAccessMemberFeatures) {
        openAuthGate("Sign in to unlock Backup Servers (Server 2 & 3).");
        return;
      }
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
    [allServers, mediaType, anilistId, id, episode, audioMode, canAccessMemberFeatures, openAuthGate]
  );

  const handleServerSelect = useCallback(
    (index: number) => {
      switchServer(index);
    },
    [switchServer]
  );

  const handleNextServer = useCallback(() => {
    if (!canAccessMemberFeatures) {
      openAuthGate("Sign in to unlock Backup Servers (Server 2 & 3).");
      return;
    }
    const total = allServers.length;
    if (total <= 1) {
      switchServer(0);
      return;
    }
    let next = (activeServerIndex + 1) % total;
    let tries = 0;
    while (failedServers.has(next) && tries < total) {
      next = (next + 1) % total;
      tries++;
    }
    if (tries >= total) {
      setFailedServers(new Set());
      next = (activeServerIndex + 1) % total;
    }
    switchServer(next);
  }, [canAccessMemberFeatures, openAuthGate, activeServerIndex, allServers.length, failedServers, switchServer]);

  // ── Auto-next / auto-skip (Zokoanime player postMessage API) ──────────
  const [autoNext, setAutoNext] = useState(true);
  const [autoSkip, setAutoSkip] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoNextRef = useRef(autoNext);
  const autoSkipRef = useRef(autoSkip);
  autoNextRef.current = autoNext;
  autoSkipRef.current = autoSkip;

  useEffect(() => {
    try {
      const n = localStorage.getItem("sf_autonext");
      const s = localStorage.getItem("sf_autoskip");
      if (n !== null) setAutoNext(n === "1");
      if (s !== null) setAutoSkip(s === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const postToZoko = useCallback((msg: Record<string, unknown>) => {
    const frame = canvasRef.current?.querySelector("iframe");
    frame?.contentWindow?.postMessage(
      { channel: "zokoanime", ...msg },
      "https://zokoanime.video"
    );
  }, []);

  const isZokoActive = (currentServerUrl || "").startsWith("https://zokoanime.video/");
  const hasNextEpisode =
    mediaType !== "movie" && (totalEpisodes ? episode < totalEpisodes : true);
  const hasPrevEpisode = mediaType !== "movie" && episode > 1;

  const goToEpisode = useCallback(
    (ep: number) => {
      if (ep < 1 || (totalEpisodes && ep > totalEpisodes)) return;
      onEpisodeChange?.(season, ep);
    },
    [onEpisodeChange, season, totalEpisodes]
  );

  const toggleAutoNext = () => {
    const v = !autoNext;
    setAutoNext(v);
    try { localStorage.setItem("sf_autonext", v ? "1" : "0"); } catch { /* ignore */ }
    postToZoko({ type: "autonext", on: v });
  };

  // ── 8-second slow-load "Switch Server" banner ─────────────────────────
  const [showSlowBanner, setShowSlowBanner] = useState(false);
  const slowBannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (slowBannerTimerRef.current) clearTimeout(slowBannerTimerRef.current);
    setShowSlowBanner(false);

    if (!isReady || !currentServerUrl || playerState === "error") return;

    slowBannerTimerRef.current = setTimeout(() => {
      setShowSlowBanner(true);
    }, 8000);

    return () => {
      if (slowBannerTimerRef.current) clearTimeout(slowBannerTimerRef.current);
    };
  }, [currentServerUrl, iframeKey, activeServerIndex, isReady, playerState]);

  const toggleAutoSkip = () => {
    if (!canAccessMemberFeatures) {
      openAuthGate("Sign in to enable Auto-Skip Intro & Outro.");
      return;
    }
    const v = !autoSkip;
    setAutoSkip(v);
    try { localStorage.setItem("sf_autoskip", v ? "1" : "0"); } catch { /* ignore */ }
    postToZoko({ type: "autoskip", on: v });
  };

  // Listen for player events: advance to the next episode when one ends.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://zokoanime.video") return;
      const msg = event.data;
      if (!msg || msg.channel !== "zokoanime") return;
      if (msg.type === "ended" && autoNextRef.current && hasNextEpisode) {
        goToEpisode(episode + 1);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [episode, hasNextEpisode, goToEpisode]);

  const handleIframeLoad = useCallback(() => {
    clearTimer();
    if (slowBannerTimerRef.current) clearTimeout(slowBannerTimerRef.current);
    setShowSlowBanner(false);
    setPlayerState("ready");
    // Sync user's saved auto-skip / auto-next preferences into the player.
    postToZoko({ type: "autoskip", on: Boolean(canAccessMemberFeatures && autoSkipRef.current) });
    postToZoko({ type: "autonext", on: autoNextRef.current });
  }, [postToZoko, canAccessMemberFeatures]);

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
  const displayTitle = mediaType === "movie" ? title : `${title} - Ep ${episode}`;

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
      {/* ── PLAYER CANVAS ──────────────────────────────────────────────── */}
      <div ref={canvasRef} className="relative w-full aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-[#07080d] border border-white/[0.08] shadow-2xl shadow-black/70">
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
                      {isReady ? `Tap to play · ${activeServer?.name}` : "Connecting to high-speed servers..."}
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
                  {activeServer?.name} - connecting...
                </p>
              </div>
            )}

            {/* ERROR */}
            {playerState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#07080d]/95 p-6 text-center animate-fade-in z-20">
                <LottieErrorAnimation className="w-32 h-32 sm:w-40 sm:h-40 -my-2" />
                <div>
                  <p className="text-white text-sm font-semibold mb-1">
                    {failedServers.size >= allServers.length
                      ? "All stream mirrors temporarily unreachable"
                      : `${activeServer?.name || "Server"} mirror unreachable`}
                  </p>
                  <p className="text-white/50 text-xs max-w-sm mx-auto">
                    {failedServers.size >= allServers.length
                      ? "We couldn't connect to any stream sources for this title right now. Please reload or check back in a few moments."
                      : "We can switch you to an alternate mirror server automatically to continue playback."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {allServers.length > 1 && (
                    <button
                      onClick={handleNextServer}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Try Next Server
                    </button>
                  )}
                  <button
                    onClick={() => handleServerSelect(activeServerIndex)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold transition-all border border-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reload Stream
                  </button>
                </div>
              </div>
            )}

            {/* OVERLAY AD-BLOCKER: Unsandboxed iframe + click shield for session-locked / embed hosts */}
            {isReady && activeServer && playerState !== "error" && (
              <OverlayAdBlocker
                key={`player-frame-${iframeKey}-${activeServerIndex}-${episode}-${selectedLang}`}
                embedUrl={currentServerUrl}
                title={displayTitle}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}

            {/* Non-intrusive Switch Server toast if iframe fails to load within 8s */}
            {showSlowBanner && !showNativeHls && playerState !== "error" && allServers.length > 1 && (
              <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0e1017]/95 border border-white/15 shadow-2xl backdrop-blur-md animate-fade-in">
                <span className="text-[11px] sm:text-xs text-white/80 font-medium">
                  Slow to load?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSlowBanner(false);
                    handleNextServer();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] sm:text-xs font-bold transition cursor-pointer"
                >
                  Switch Server
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlowBanner(false)}
                  aria-label="Dismiss"
                  className="p-1 rounded-md text-white/40 hover:text-white transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── BENEATH-PLAYER CONTROLS & SERVER DROPDOWN (Aniflix Style) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-[#0c0d12]/90 border border-white/[0.08] backdrop-blur-xl shadow-lg">
        {/* Left: Server Dropdown Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer group"
            title="Click to switch server"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 font-medium text-xs">Server:</span>
            <span className="text-emerald-300 group-hover:text-emerald-200">{activeServer?.name || "Server 1"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${
                isDropdownOpen ? "rotate-180 text-emerald-400" : ""
              }`}
            />
          </button>

          {/* Floating Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 sm:w-80 bg-[#0e1017] border border-white/15 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-50 animate-scale-in">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  Select Mirror ({allServers.length})
                </span>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsServerModalOpen(true);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  All Specs ↗
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto no-scrollbar flex flex-col gap-1">
                {allServers.map((srv, idx) => {
                  const isActive = activeServerIndex === idx;
                  const failed = failedServers.has(idx);
                  return (
                    <button
                      key={srv.id}
                      onClick={() => {
                        handleServerSelect(idx);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                        isActive && !failed
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                          : failed
                          ? "bg-red-500/5 text-red-400/50 line-through border border-red-500/10"
                          : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"
                          }`}
                        />
                        <span className="truncate font-semibold">{srv.name}</span>
                        {srv.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/10 text-white/60">
                            {srv.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {srv.description && (
                          <span className="text-[10px] text-white/40 hidden sm:inline">{srv.description}</span>
                        )}
                        {idx > 0 && !canAccessMemberFeatures && (
                          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-emerald-400 font-medium">
                          {srv.quality || "HD"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Language / Dub Quick Switcher (Movies & TV) */}
          {mediaType !== "anime" && onLangCycle && (
            <button
              onClick={onLangCycle}
              title="Switch audio preference (English / Hindi / Tamil / Telugu)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/85 text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span className="uppercase">
                {selectedLang === "hi"
                  ? "Hindi"
                  : selectedLang === "ta"
                  ? "Tamil"
                  : selectedLang === "te"
                  ? "Telugu"
                  : "English"}
              </span>
            </button>
          )}

          {/* Previous / Next Episode */}
          {mediaType !== "movie" && (
            <>
              <button
                onClick={() => goToEpisode(episode - 1)}
                disabled={!hasPrevEpisode || !onEpisodeChange}
                title="Previous episode"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed text-white/80 text-xs font-semibold border border-white/10 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                <span className="hidden sm:inline">Prev Ep</span>
              </button>
              <button
                onClick={() => goToEpisode(episode + 1)}
                disabled={!hasNextEpisode || !onEpisodeChange}
                title="Next episode"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition cursor-pointer"
              >
                <span>Next Ep</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Auto-Next / Auto-Skip toggles (Zokoanime player) */}
          {isZokoActive && (
            <>
              <button
                onClick={toggleAutoNext}
                title="Automatically play the next episode when this one ends"
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  autoNext
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/[0.05] text-white/50 border-white/10"
                }`}
              >
                Auto-Next {autoNext ? "On" : "Off"}
              </button>
              <button
                onClick={toggleAutoSkip}
                title={canAccessMemberFeatures ? "Automatically skip intros and outros" : "Sign in to enable Auto-Skip"}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  canAccessMemberFeatures && autoSkip
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-white/[0.05] text-white/55 border-white/10"
                }`}
              >
                {!canAccessMemberFeatures && <Lock className="w-3 h-3 text-amber-400" />}
                <span>Auto-Skip {canAccessMemberFeatures && autoSkip ? "On" : "Off"}</span>
              </button>
            </>
          )}

          {/* Stream 404? / Report Broken */}
          <button
            onClick={handleIframeError}
            title="Stream 404 or broken? Click to report and switch server"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold border border-rose-500/20 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Stream 404?</span>
          </button>

          {/* Reload Stream */}
          <button
            onClick={() => handleServerSelect(activeServerIndex)}
            title="Reload current stream"
            className="p-1.5 sm:p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white border border-white/10 transition cursor-pointer"
            aria-label="Reload current server"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Next Server */}
          {allServers.length > 1 && (
            <button
              onClick={handleNextServer}
              title="Next server"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Open External */}
          <button
            onClick={handleOpenExternal}
            title="Open in clean external tab"
            className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition cursor-pointer"
            aria-label="Open in external tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── STATUS HINT LINE ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-white/40 font-medium">
          {showNativeHls
            ? `Direct Ad-Free Stream Active (${activeServer?.name || "Server"})`
            : isResolvingStream || playerState === "loading"
            ? `Connecting to ${activeServer?.name}...`
            : playerState === "ready"
            ? `Connected to ${activeServer?.name}`
            : playerState === "error"
            ? `${activeServer?.name} unavailable`
            : isReady
            ? `Ready to stream via ${activeServer?.name}`
            : "Locating stream servers..."}
        </p>
        {failedServers.size > 0 && (
          <p className="text-[11px] text-orange-400/70">{failedServers.size} mirror(s) failed</p>
        )}
      </div>

      {/* Clear audio-switch guidance for VidRock's hidden Cloud menu */}
      {mediaType !== "anime" && (currentServerUrl || "").includes("vidrock.net") && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition ${
            selectedLang !== "en"
              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-200"
              : "bg-white/[0.03] border-white/[0.07] text-white/60"
          }`}
        >
          <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">
            {selectedLang === "hi"
              ? "Hindi Dub selected — tap the Cloud icon inside the VidRock player (bottom-right) and pick the Hindi server."
              : selectedLang === "ta"
              ? "Tamil selected — tap the Cloud icon inside the VidRock player (bottom-right) and pick the Tamil/Hindi server."
              : selectedLang === "te"
              ? "Telugu selected — tap the Cloud icon inside the VidRock player (bottom-right) and pick the Telugu/Hindi server."
              : "For Hindi, Tamil, or Telugu dub audio: tap the Cloud icon inside the VidRock player (bottom-right) to switch audio servers."}
          </span>
        </div>
      )}

      {/* ── ANIFLIX SHADOW ARMY SERVER SWITCHER MODAL ─────────────────── */}
      {isServerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsServerModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
          />
          <div className="relative w-full max-w-lg bg-[#0c0d12]/95 border border-white/10 rounded-[26px] p-5 sm:p-6 shadow-2xl backdrop-blur-2xl z-10 max-h-[85vh] overflow-y-auto no-scrollbar animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/15">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    <span>Shadow Army</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Ad-Free
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50">High-speed CDN server management</p>
                </div>
              </div>
              <button
                onClick={() => setIsServerModalOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition border border-white/5 cursor-pointer"
                aria-label="Close server manager"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language Quick Tabs (Authentic Original & Dub Tracks) */}
            {mediaType === "anime" && (
              <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/5 my-4">
                {[
                  { id: "sub", code: "JAP (SUB)", label: "Original Audio + Subtitles" },
                  { id: "dub", code: "ENG (DUB)", label: "English Dubbed" },
                ].map((tab) => {
                  const isActive = (audioMode === "dub" && tab.id === "dub") || (audioMode === "sub" && tab.id === "sub");
                  return (
                    <div
                      key={tab.id}
                      className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition-all ${
                        isActive
                          ? "bg-white text-black shadow-md font-extrabold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {tab.code}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Server Roster */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1">
                Active Mirrors ({allServers.length})
              </span>
              {allServers.map((srv, idx) => {
                const isActive = activeServerIndex === idx;
                const isFailed = failedServers.has(idx);
                return (
                  <button
                    key={srv.id}
                    onClick={() => {
                      handleServerSelect(idx);
                      setIsServerModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer group ${
                      isActive && !isFailed
                        ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10 text-emerald-300 font-semibold"
                        : isFailed
                        ? "bg-red-500/5 border-red-500/20 text-red-400/60 line-through opacity-60"
                        : "bg-white/[0.03] hover:bg-white/[0.07] border-white/5 text-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-md shrink-0 transition-transform group-hover:scale-105 ${
                          isActive
                            ? "bg-emerald-500 text-black shadow-emerald-500/30"
                            : "bg-white/10 text-white/80 group-hover:bg-emerald-500/20 group-hover:text-emerald-300"
                        }`}
                      >
                        {srv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-300">
                            {srv.name}
                          </span>
                          {srv.badge && (
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-[10px] font-semibold border border-white/5">
                              {srv.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-white/40 block mt-0.5">
                          {srv.description || (srv.quality ? `${srv.quality} High Speed` : "Ad-Free Server")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {idx > 0 && !canAccessMemberFeatures && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                          <Lock className="w-3 h-3" />
                          Sign in
                        </span>
                      )}
                      {isActive && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Connected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
