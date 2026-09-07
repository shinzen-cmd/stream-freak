"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  Clock,
  Calendar,
  Plus,
  Check,
  Play,
  Tv,
  Sparkles,
  X,
  Download,
} from "lucide-react";
import { MediaDetail } from "@/types/media";
import VideoPlayer from "@/components/VideoPlayerModal";
import EpisodeSelector from "@/components/EpisodeSelector";
import MediaRow from "@/components/MediaRow";
import DownloadModal from "@/components/DownloadModal";
import { useWatchlist } from "@/context/WatchlistContext";
import { getAnimeStream } from "@/lib/getAnimeStream";

interface WatchClientViewProps {
  initialData: MediaDetail;
  initialSeason?: number;
  initialEpisode?: number;
  autoPlay?: boolean;
}

function triggerBrowserDownload(url: string, targetFilename: string) {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", targetFilename);
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer");
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 100);
}

export default function WatchClientView({
  initialData,
  initialSeason = 1,
  initialEpisode = 1,
  autoPlay = false,
}: WatchClientViewProps) {
  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [currentEpTitle, setCurrentEpTitle] = useState<string | undefined>(undefined);
  const [audioMode, setAudioMode] = useState<"sub" | "dub">("sub");
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStreamUrl, setDownloadStreamUrl] = useState<string | null>(null);
  const [downloadRawUrl, setDownloadRawUrl] = useState<string | null>(null);


  /**
   * Hydration guard: `isInWatchlist` reads localStorage which is client-only.
   * Without this, server renders isSaved=false and client renders true → mismatch.
   */
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  // Only read watchlist state after mount to avoid hydration mismatch
  const isSaved = hasMounted ? isInWatchlist(initialData.id) : false;

  const handleEpisodeChange = useCallback(
    (season: number, episode: number, title?: string) => {
      setCurrentSeason(season);
      setCurrentEpisode(episode);
      setCurrentEpTitle(title);
      // Smooth scroll to player on mobile
      window.scrollTo({ top: 120, behavior: "smooth" });
    },
    []
  );

  // Memoized trailer lookup — was re-computed every render
  const trailerVideo = useMemo(
    () =>
      initialData.videos?.find(
        (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
      ),
    [initialData.videos]
  );

  /**
   * Direct media stream downloader & clean external player tab opener.
   * If direct HLS/MP4 stream exists, initiates browser download directly.
   * Never redirects to ad-heavy vidsrc.me landing pages.
   */
  const handleDownload = useCallback(async () => {
    const malId = initialData.malId;
    const aniId = String(initialData.anilistId || initialData.id).replace("anime-", "");
    const tmdbId = initialData.tmdbId || initialData.id;
    const audio = audioMode;
    const ep = currentEpisode;
    const sanitizedTitle = initialData.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
    const filename = initialData.mediaType === "movie" 
      ? `${sanitizedTitle}.mp4` 
      : `${sanitizedTitle}_S${currentSeason}E${ep}.mp4`;

    if (initialData.mediaType === "anime") {
      try {
        const res = await getAnimeStream({
          anilistId: initialData.anilistId || initialData.id,
          malId: malId ?? null,
          title: initialData.title,
          episodeNumber: ep,
          audioMode: audio,
        });

        // 1. Direct download URL if available
        if (res.downloadUrl) {
          triggerBrowserDownload(res.downloadUrl, filename);
          return;
        }

        // 2. Direct MP4 / HLS source
        if (res.directSources && res.directSources.length > 0) {
          const directSrc = res.directSources[0].url;
          setDownloadStreamUrl(directSrc);
          setDownloadRawUrl(directSrc);
          triggerBrowserDownload(directSrc, filename);
          return;
        }
      } catch {
        // Fallback to Download Hub modal
      }

      setShowDownloadModal(true);
      return;
    }

    // Movies & TV Shows: Attempt ad-free direct stream extraction via Phase 1 Resolver
    try {
      const res = await fetch(
        `/api/stream/resolve?mediaType=${initialData.mediaType}&id=${tmdbId}&season=${currentSeason}&episode=${ep}&lang=${selectedLang}`
      );
      const data = await res.json();
      if (data.success && data.streamUrl) {
        setDownloadStreamUrl(data.streamUrl);
        setDownloadRawUrl(data.rawUrl || data.streamUrl);
        triggerBrowserDownload(data.streamUrl, filename);
        return;
      }
      if (data.rawUrl || data.streamUrl) {
        setDownloadStreamUrl(data.streamUrl);
        setDownloadRawUrl(data.rawUrl || data.streamUrl);
      }
    } catch {
      // Fallback
    }

    // Clean in-app Download Hub modal (No external redirects to ad sites!)
    setShowDownloadModal(true);
  }, [
    initialData.mediaType,
    initialData.malId,
    initialData.anilistId,
    initialData.id,
    initialData.tmdbId,
    initialData.title,
    currentEpisode,
    currentSeason,
    audioMode,
    selectedLang,
  ]);

  return (
    <div className="min-h-screen pb-20 pt-16 xs:pt-20 3xl:pt-24">
      {/* Background Ambience Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {initialData.backdropPath && (
          <div className="relative w-full h-[600px] 3xl:h-[900px] opacity-15 blur-3xl scale-110">
            <Image
              src={initialData.backdropPath}
              alt=""
              fill
              className="object-cover"
              priority
            />
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 space-y-4 xs:space-y-6">
        {/* Stream Video Player Section */}
        <section id="player-container" className="scroll-mt-24 space-y-2.5 xs:space-y-3">
          {/* Upcoming Unreleased Episode Notice */}
          {initialData.mediaType === "anime" &&
            initialData.nextAiringEpisode &&
            currentEpisode >= initialData.nextAiringEpisode.episode && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs sm:text-sm">
                <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-300">
                    Upcoming Episode — Not Yet Aired
                  </p>
                  <p className="text-amber-200/70 text-xs mt-0.5">
                    Episode {currentEpisode} is scheduled to air on{" "}
                    {new Date(initialData.nextAiringEpisode.airingAt * 1000).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    . Earlier episodes are available in the episode selector below.
                  </p>
                </div>
              </div>
            )}

          <VideoPlayer
            mediaType={initialData.mediaType}
            id={initialData.id}
            tmdbId={initialData.tmdbId}
            anilistId={initialData.anilistId}
            malId={initialData.malId}
            audioMode={audioMode}
            selectedLang={selectedLang}
            title={initialData.title}
            posterPath={initialData.posterPath}
            backdropPath={initialData.backdropPath}
            season={currentSeason}
            episode={currentEpisode}
            episodeTitle={currentEpTitle}
            autoPlay={autoPlay}
          />

          {/* Universal Multi-Audio Selector Bar (MovieBox Architecture) */}
          <div className="max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl 4xl:max-w-[2000px] 5xl:max-w-[2600px] mx-auto flex flex-wrap items-center justify-between gap-2 px-3 xs:px-4 py-2.5 xs:py-3 rounded-xl xs:rounded-2xl bg-[#0e131f]/90 border border-white/[0.08] backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-1.5 xs:gap-2 text-[11px] xs:text-xs 3xl:text-sm font-semibold text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Audio Language:</span>
            </div>

            {initialData.mediaType === "anime" ? (
              <div className="flex items-center gap-1 xs:gap-1.5 bg-black/60 p-0.5 xs:p-1 rounded-lg xs:rounded-xl border border-white/[0.06]">
                <button
                  onClick={() => setAudioMode("sub")}
                  aria-pressed={audioMode === "sub"}
                  className={`px-2.5 xs:px-4 py-1 xs:py-1.5 rounded-md xs:rounded-lg text-[10px] xs:text-xs 3xl:text-sm font-bold transition-all ${
                    audioMode === "sub"
                      ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Japanese (SUB)
                </button>
                <button
                  onClick={() => setAudioMode("dub")}
                  aria-pressed={audioMode === "dub"}
                  className={`px-2.5 xs:px-4 py-1 xs:py-1.5 rounded-md xs:rounded-lg text-[10px] xs:text-xs 3xl:text-sm font-bold transition-all ${
                    audioMode === "dub"
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  English (DUB)
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 xs:gap-1.5 bg-black/60 p-0.5 xs:p-1 rounded-lg xs:rounded-xl border border-white/[0.06]">
                {[
                  { code: "en", label: "Original (English)" },
                  { code: "hi", label: "Hindi Dub" },
                  { code: "es", label: "Spanish Dub" },
                  { code: "fr", label: "French Dub" },
                  { code: "ta", label: "Tamil Dub" },
                ].map((item) => {
                  const isSelected = selectedLang === item.code;
                  return (
                    <button
                      key={item.code}
                      onClick={() => setSelectedLang(item.code)}
                      aria-pressed={isSelected}
                      className={`px-2.5 xs:px-3 py-1 rounded-md xs:rounded-lg text-[10px] xs:text-xs 3xl:text-sm font-bold transition-all ${
                        isSelected
                          ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30 font-extrabold"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Media Metadata & Action Header */}
        <div className="glass-panel p-4 xs:p-6 sm:p-8 rounded-2xl xs:rounded-3xl border border-white/[0.08] space-y-4 xs:space-y-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 xs:gap-6">
            {/* Title & Tagline */}
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 xs:gap-2">
                <span
                  className={`text-[10px] xs:text-xs 3xl:text-sm font-bold uppercase tracking-wider px-2 xs:px-2.5 py-0.5 xs:py-1 rounded-md ${
                    initialData.mediaType === "movie"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : initialData.mediaType === "tv"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  }`}
                >
                  {initialData.mediaType}
                </span>

                {initialData.mediaType !== "movie" && (
                  <span className="text-[10px] xs:text-xs 3xl:text-sm font-bold px-2 xs:px-2.5 py-0.5 xs:py-1 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {initialData.mediaType === "tv" ? `Season ${currentSeason} • ` : ""}
                    Episode {currentEpisode}
                    {currentEpTitle ? `: ${currentEpTitle}` : ""}
                  </span>
                )}

                {initialData.status && (
                  <span className="text-[10px] xs:text-xs 3xl:text-sm px-2 xs:px-2.5 py-0.5 xs:py-1 rounded-md bg-white/5 text-gray-300 border border-white/10">
                    {initialData.status}
                  </span>
                )}
              </div>

              <h1 className="text-xl xs:text-2xl sm:text-4xl 3xl:text-5xl font-extrabold text-white tracking-tight">
                {initialData.title}
              </h1>

              {initialData.originalTitle && initialData.originalTitle !== initialData.title && (
                <p className="text-xs xs:text-sm 3xl:text-base text-gray-400 italic">Native: {initialData.originalTitle}</p>
              )}

              {initialData.tagline && (
                <p className="text-xs xs:text-sm sm:text-base 3xl:text-lg text-cyan-300/90 italic">
                  &ldquo;{initialData.tagline}&rdquo;
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 xs:gap-3">
              <button
                onClick={() => toggleWatchlist(initialData)}
                className={`flex items-center gap-1.5 xs:gap-2 px-3.5 xs:px-5 py-2 xs:py-3 3xl:px-6 3xl:py-3.5 rounded-xl text-xs xs:text-sm 3xl:text-base font-semibold border transition-all ${
                  isSaved
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                    : "bg-white/5 text-white border-white/15 hover:bg-white/15"
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-rose-400" />
                    <span>In Watchlist</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-cyan-400" />
                    <span>Add to Watchlist</span>
                  </>
                )}
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                title="Open stream in external tab for download"
                className="flex items-center gap-1.5 xs:gap-2 px-3.5 xs:px-5 py-2 xs:py-3 3xl:px-6 3xl:py-3.5 rounded-xl text-xs xs:text-sm 3xl:text-base font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition"
              >
                <Download className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-emerald-400" />
                <span>Download</span>
              </button>

              {trailerVideo && (
                <button
                  onClick={() => setShowTrailerModal(true)}
                  className="flex items-center gap-1.5 xs:gap-2 px-3.5 xs:px-5 py-2 xs:py-3 3xl:px-6 3xl:py-3.5 rounded-xl text-xs xs:text-sm 3xl:text-base font-semibold bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 transition"
                >
                  <Play className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-rose-500 fill-rose-500" />
                  <span>Trailer</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 border-t border-white/10 text-xs sm:text-sm text-gray-300">
            {initialData.voteAverage > 0 && (
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs">
                  ★ {initialData.voteAverage}
                </span>
                <span>Rating</span>
              </div>
            )}

            {initialData.releaseDate && (
              <div className="flex items-center gap-1.5 text-gray-300">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{initialData.releaseDate.slice(0, 4)}</span>
              </div>
            )}

            {initialData.runtime && (
              <div className="flex items-center gap-1.5 text-gray-300">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>{initialData.runtime} mins</span>
              </div>
            )}

            {initialData.totalEpisodes && (
              <div className="flex items-center gap-1.5 text-gray-300">
                <Tv className="w-4 h-4 text-purple-400" />
                <span>{initialData.totalEpisodes} Total Episodes</span>
              </div>
            )}

            {initialData.studios && initialData.studios.length > 0 && (
              <div className="flex items-center gap-1.5 text-gray-300">
                <span>Studio: {initialData.studios.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Genres Badges */}
          {initialData.genresList && initialData.genresList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {initialData.genresList.map((g) => (
                <Link
                  key={g.id}
                  href={`/explore?type=${initialData.mediaType}&genre=${g.id}`}
                  className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}

          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Storyline
            </h3>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-normal">
              {initialData.overview}
            </p>
          </div>
        </div>

        {/* Episode Selector (For TV Shows & Anime) */}
        {initialData.mediaType !== "movie" && (
          <EpisodeSelector
            mediaType={initialData.mediaType}
            tmdbId={initialData.tmdbId}
            seasons={initialData.seasons}
            totalEpisodes={initialData.episodesCount || initialData.totalEpisodes || 12}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            onSelectEpisode={handleEpisodeChange}
          />
        )}

        {/* Cast & Characters Section */}
        {initialData.cast && initialData.cast.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">
              {initialData.mediaType === "anime" ? "Characters & Voice Cast" : "Top Billed Cast"}
            </h3>

            <div className="grid grid-cols-3 min-[380px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-10 3xl:grid-cols-12 4xl:grid-cols-16 gap-2 xs:gap-3 3xl:gap-4">
              {initialData.cast.slice(0, 16).map((member) => (
                <div
                  key={member.id}
                  className="glass-panel p-2 rounded-xl border border-white/5 flex flex-col items-center text-center group"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-800 mb-2 border border-white/10 group-hover:border-cyan-400 transition">
                    {member.profilePath ? (
                      <Image
                        src={member.profilePath}
                        alt={member.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                        {member.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-cyan-300">
                    {member.name}
                  </h4>
                  <p className="text-[10px] text-gray-400 line-clamp-1">{member.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations & Similar Row */}
        {initialData.recommendations && initialData.recommendations.length > 0 && (
          <MediaRow
            title="You May Also Like"
            subtitle="More Like This"
            items={initialData.recommendations}
            iconName="film"
          />
        )}
      </div>

      {/* Trailer Modal Popup */}
      {showTrailerModal && trailerVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-rose-500 fill-rose-500" />
                {trailerVideo.name || `${initialData.title} Official Trailer`}
              </span>
              <button
                onClick={() => setShowTrailerModal(false)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close trailer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${trailerVideo.key}?autoplay=1`}
                title="Official Trailer"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Download Hub Modal (Zero Ad Redirects) */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title={initialData.title}
        posterPath={initialData.posterPath}
        backdropPath={initialData.backdropPath}
        mediaType={initialData.mediaType}
        season={currentSeason}
        episode={currentEpisode}
        episodeTitle={currentEpTitle}
        selectedLang={selectedLang}
        directStreamUrl={downloadStreamUrl}
        rawStreamUrl={downloadRawUrl}
        onTriggerDirectDownload={() => {
          if (downloadStreamUrl) {
            const filename = `${initialData.title.replace(/[^\w\s-]/g, "")}_${
              initialData.mediaType === "movie" ? "Movie" : `S${currentSeason}E${currentEpisode}`
            }_1080p.mp4`;
            triggerBrowserDownload(downloadStreamUrl, filename);
          }
        }}
      />
    </div>
  );
}
