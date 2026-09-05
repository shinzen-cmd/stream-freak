"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Settings,
  AlertTriangle,
  Loader2,
  Check,
  SkipForward,
  Subtitles,
} from "lucide-react";

interface SkipTime {
  start: number;
  end: number;
}

interface HlsVideoPlayerProps {
  src: string;
  poster?: string | null;
  subtitles?: Array<{ url: string; lang: string }>;
  title?: string;
  introSkip?: SkipTime;
  outroSkip?: SkipTime;
  onError?: (err: Error | string) => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export default function HlsVideoPlayer({
  src,
  poster,
  title,
  subtitles = [],
  introSkip,
  outroSkip,
  onError,
  onEnded,
  onTimeUpdate,
  onFullscreenChange,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [levels, setLevels] = useState<Array<{ index: number; height: number; bitrate: number }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [activeSubIndex, setActiveSubIndex] = useState<number>(-1); // -1 = off
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearControlsTimeout(), [clearControlsTimeout]);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Initialize HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLevels([]);
    setCurrentLevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      let networkErrors = 0;
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setHasError(true);
        onErrorRef.current?.("HLS stream load timeout");
      }, 5000);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        clearTimeout(timeoutId);
        setIsLoading(false);
        const parsed = (data.levels || []).map((lvl, index) => ({
          index,
          height: lvl.height,
          bitrate: lvl.bitrate,
        }));
        setLevels(parsed);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          clearTimeout(timeoutId);
          setIsLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              networkErrors++;
              if (networkErrors <= 2) {
                hls.startLoad();
              } else {
                hls.destroy();
                setHasError(true);
                onErrorRef.current?.("HLS network error (CORS or stream offline)");
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setHasError(true);
              onErrorRef.current?.("HLS fatal playback error");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") || src.includes(".mp4")) {
      video.src = src;
      const onMeta = () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      };
      const onErr = () => {
        setIsLoading(false);
        setHasError(true);
        onErrorRef.current?.("Native media load error");
      };
      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("error", onErr);
      return () => {
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("error", onErr);
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    } else {
      setIsLoading(false);
      setHasError(true);
      onErrorRef.current?.("Browser does not support direct HLS playback");
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // Time-based skip overlays
  useEffect(() => {
    if (introSkip) {
      const inRange = currentTime >= introSkip.start && currentTime < introSkip.end;
      setShowSkipIntro(inRange);
    } else {
      setShowSkipIntro(false);
    }
    if (outroSkip) {
      const inRange = currentTime >= outroSkip.start && currentTime < outroSkip.end;
      setShowSkipOutro(inRange);
    } else {
      setShowSkipOutro(false);
    }
  }, [currentTime, introSkip, outroSkip]);

  // Subtitle track injection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Remove existing text tracks
    while (video.textTracks.length > 0) {
      // We can't remove tracks directly — clear the track elements instead
      break;
    }
    // We'll rely on the <track> elements rendered in JSX
  }, [subtitles]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const target = parseFloat(e.target.value);
    video.currentTime = target;
    setCurrentTime(target);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const target = parseFloat(e.target.value);
    video.volume = target;
    setVolume(target);
    setIsMuted(target === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 1;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => { setIsFullscreen(true); onFullscreenChange?.(true); })
        .catch(() => {});
    } else {
      document.exitFullscreen()
        .then(() => { setIsFullscreen(false); onFullscreenChange?.(false); })
        .catch(() => {});
    }
  }, [onFullscreenChange]);

  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      onFullscreenChange?.(inFs);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [onFullscreenChange]);

  const skipTime = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  }, []);

  const skipTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const handleQualitySelect = useCallback((levelIdx: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
      setCurrentLevel(levelIdx);
    }
    setShowQualityMenu(false);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearControlsTimeout();
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) setShowControls(false);
    }, 3000);
  }, [clearControlsTimeout]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      switch (e.key.toLowerCase()) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "arrowleft": case "j": e.preventDefault(); skipTime(-10); break;
        case "arrowright": case "l": e.preventDefault(); skipTime(10); break;
        case "arrowup":
          e.preventDefault();
          if (videoRef.current) { const v = Math.min(1, (videoRef.current.volume || 0) + 0.1); videoRef.current.volume = v; setVolume(v); setIsMuted(false); }
          break;
        case "arrowdown":
          e.preventDefault();
          if (videoRef.current) { const v = Math.max(0, (videoRef.current.volume || 0) - 0.1); videoRef.current.volume = v; setVolume(v); setIsMuted(v === 0); }
          break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); toggleMute(); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, skipTime, toggleFullscreen, toggleMute]);

  if (hasError) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 gap-3 bg-[#0d0d12]">
        <AlertTriangle className="w-10 h-10 text-rose-400" />
        <p className="text-white font-semibold">Direct stream unavailable</p>
        <p className="text-xs text-gray-400">Switching to embed mirror automatically...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full h-full bg-black select-none"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={poster || undefined}
        onClick={togglePlay}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const ct = videoRef.current.currentTime;
            const d = videoRef.current.duration || 0;
            setCurrentTime(ct);
            setDuration(d);
            onTimeUpdate?.(ct, d);
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={onEnded}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      >
        {/* Subtitle tracks */}
        {subtitles.map((sub, i) => (
          <track
            key={i}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.lang.toLowerCase().slice(0, 2)}
            label={sub.lang}
            default={activeSubIndex === i}
          />
        ))}
      </video>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none z-20">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-2" />
          <p className="text-xs text-gray-300 font-medium">Buffering stream...</p>
        </div>
      )}

      {/* Skip Intro Button */}
      {showSkipIntro && introSkip && (
        <button
          onClick={() => skipTo(introSkip.end)}
          className="absolute bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold backdrop-blur-sm transition-all animate-fade-in"
        >
          <SkipForward className="w-4 h-4" />
          Skip Intro
        </button>
      )}

      {/* Skip Outro Button */}
      {showSkipOutro && outroSkip && (
        <button
          onClick={() => skipTo(outroSkip.end)}
          className="absolute bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/80 hover:bg-cyan-400 text-black text-sm font-bold backdrop-blur-sm transition-all animate-fade-in"
        >
          <SkipForward className="w-4 h-4" />
          Skip Outro
        </button>
      )}

      {/* Top Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white transition-opacity duration-300 z-30 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[11px] font-bold">
            DIRECT HLS
          </span>
          {title && <h3 className="text-sm font-semibold truncate max-w-md">{title}</h3>}
        </div>

        <div className="flex items-center gap-2">
          {/* Subtitle selector */}
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowSubMenu((p) => !p); setShowQualityMenu(false); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>{activeSubIndex === -1 ? "Off" : subtitles[activeSubIndex]?.lang}</span>
              </button>
              {showSubMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-white/10 bg-[#111827]/95 backdrop-blur-md shadow-2xl p-1 z-40">
                  <button
                    onClick={() => { setActiveSubIndex(-1); setShowSubMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between font-semibold ${activeSubIndex === -1 ? "bg-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
                  >
                    <span>Off</span>
                    {activeSubIndex === -1 && <Check className="w-3.5 h-3.5" />}
                  </button>
                  {subtitles.map((sub, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveSubIndex(i); setShowSubMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between font-semibold ${activeSubIndex === i ? "bg-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      <span>{sub.lang}</span>
                      {activeSubIndex === i && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quality selector */}
          {levels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowQualityMenu((p) => !p); setShowSubMenu(false); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>
                  {currentLevel === -1
                    ? "Auto"
                    : levels.find((l) => l.index === currentLevel)?.height
                    ? `${levels.find((l) => l.index === currentLevel)?.height}p`
                    : "HD"}
                </span>
              </button>
              {showQualityMenu && (
                <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-white/10 bg-[#111827]/95 backdrop-blur-md shadow-2xl p-1 z-40">
                  <button
                    onClick={() => handleQualitySelect(-1)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between font-semibold ${currentLevel === -1 ? "bg-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
                  >
                    <span>Auto (Adaptive)</span>
                    {currentLevel === -1 && <Check className="w-3.5 h-3.5" />}
                  </button>
                  {levels.map((lvl) => (
                    <button
                      key={lvl.index}
                      onClick={() => handleQualitySelect(lvl.index)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between font-semibold ${currentLevel === lvl.index ? "bg-cyan-500 text-black" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      <span>{lvl.height}p</span>
                      {currentLevel === lvl.index && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center Play Overlay */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-cyan-500/90 text-black flex items-center justify-center shadow-xl shadow-cyan-500/40 hover:scale-110 transition duration-200 z-20"
        >
          <Play className="w-8 h-8 fill-current ml-1" />
        </button>
      )}

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2 transition-opacity duration-300 z-30 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrubber */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:h-2 transition-all"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-xs pt-1">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-cyan-400 p-1 transition">
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button onClick={() => skipTime(-10)} className="hover:text-cyan-400 p-1 transition" title="Rewind 10s">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => skipTime(10)} className="hover:text-cyan-400 p-1 transition" title="Forward 10s">
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleMute} className="hover:text-cyan-400 p-1 transition">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div className="font-mono text-gray-300 text-[11px] ml-1">
              <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullscreen} className="hover:text-cyan-400 p-1 transition">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
