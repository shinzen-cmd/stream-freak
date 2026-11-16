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
  X,
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Film,
  ExternalLink,
} from "lucide-react";
import { MediaDetail } from "@/types/media";
import VideoPlayer from "@/components/VideoPlayerModal";
import EpisodeSelector from "@/components/EpisodeSelector";
import MediaRow from "@/components/MediaRow";
import DownloadModal from "@/components/DownloadModal";
import { useWatchlist } from "@/context/WatchlistContext";
import { useAuth } from "@/context/AuthContext";
import { getZokoAnimeDownloadUrl } from "@/lib/getAnimeStream";
import { getVidVaultDownloadUrl } from "@/lib/playerSources";

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

// Live Countdown Timer for Upcoming Episodes (Aniflix Signature)
function UpcomingCountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTimestamp - now;
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setTimeLeft({ days, hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {[
        { label: "Days", val: timeLeft.days },
        { label: "Hrs", val: timeLeft.hours },
        { label: "Min", val: timeLeft.minutes },
        { label: "Sec", val: timeLeft.seconds },
      ].map((box) => (
        <div
          key={box.label}
          className="flex flex-col items-center justify-center min-w-[46px] sm:min-w-[52px] py-1 px-1.5 rounded-xl bg-black/60 border border-white/10"
        >
          <span className="text-xs sm:text-sm font-extrabold text-white font-mono leading-none">
            {box.val < 10 ? `0${box.val}` : box.val}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5 font-semibold">
            {box.label}
          </span>
        </div>
      ))}
    </div>
  );
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
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [userComment, setUserComment] = useState("");
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string; episode: number }>>([]);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const { canAccessMemberFeatures, openAuthGate } = useAuth();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const isSaved = hasMounted ? isInWatchlist(initialData.id) : false;

  const handleEpisodeChange = useCallback(
    (season: number, episode: number, title?: string) => {
      setCurrentSeason(season);
      setCurrentEpisode(episode);
      setCurrentEpTitle(title);
      // Smooth scroll to player on mobile
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        const playerEl = document.getElementById("player-container");
        if (playerEl) {
          playerEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    []
  );

  // Quick Cycle Audio (Aniflix Feature: Sub -> Dub -> Hindi -> Sub)
  const handleQuickAudioCycle = useCallback(() => {
    if (initialData.mediaType === "anime") {
      if (audioMode === "sub") {
        setAudioMode("dub");
      } else {
        setAudioMode("sub");
      }
    } else {
      const langs = ["en", "hi", "es", "fr"];
      const nextIdx = (langs.indexOf(selectedLang) + 1) % langs.length;
      setSelectedLang(langs[nextIdx]);
    }
  }, [initialData.mediaType, audioMode, selectedLang]);

  // Trailer lookup
  const trailerVideo = useMemo(
    () =>
      initialData.videos?.find(
        (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
      ),
    [initialData.videos]
  );

  // Direct media stream downloader (requires sign-in on mobile/web; unlocked on TV)
  const handleDownload = useCallback(async () => {
    if (!canAccessMemberFeatures) {
      openAuthGate("Sign in to download episodes and movies.");
      return;
    }
    const tmdbId = initialData.tmdbId || (typeof initialData.id === "number" ? initialData.id : undefined);
    const cleanAniId =
      initialData.anilistId ||
      (typeof initialData.id === "string" ? initialData.id.replace("anime-", "") : initialData.id);

    try {
      if (initialData.mediaType === "anime") {
        const zokoDownloadUrl = getZokoAnimeDownloadUrl({
          anilistId: cleanAniId,
          malId: initialData.malId,
          episodeNumber: currentEpisode,
          audioMode,
        });
        setDownloadStreamUrl(zokoDownloadUrl);
        setDownloadRawUrl(zokoDownloadUrl);
        setShowDownloadModal(true);
        return;
      }

      const vidVaultUrl = getVidVaultDownloadUrl({
        mediaType: initialData.mediaType === "tv" ? "tv" : "movie",
        tmdbId,
        id: initialData.id,
        season: currentSeason,
        episode: currentEpisode,
      });
      setDownloadStreamUrl(vidVaultUrl);
      setDownloadRawUrl(vidVaultUrl);
      setShowDownloadModal(true);
      return;
    } catch {
      // Show fallback modal
    }
    setDownloadStreamUrl(null);
    setDownloadRawUrl(null);
    setShowDownloadModal(true);
  }, [canAccessMemberFeatures, openAuthGate, initialData, currentSeason, currentEpisode, audioMode, selectedLang]);

  // Add Comment Handler
  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userComment.trim()) return;
    setComments((prev) => [
      {
        id: String(Date.now()),
        user: "Viewer",
        text: userComment.trim(),
        time: "Just now",
        episode: currentEpisode,
      },
      ...prev,
    ]);
    setUserComment("");
  };

  const currentDisplayTitle =
    currentEpTitle || (initialData.mediaType === "movie" ? initialData.title : `Episode ${currentEpisode}`);

  return (
    <div className="min-h-screen pb-28 pt-[calc(4rem+env(safe-area-inset-top,0px))] xs:pt-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(5.25rem+env(safe-area-inset-top,0px))]">
      {/* Background Ambience Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {initialData.backdropPath && (
          <div className="relative w-full h-[600px] opacity-10 blur-3xl scale-110">
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

      <div className="relative z-10 max-w-[1700px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Breadcrumb Navigation Bar (Aniflix Style) */}
        <div className="flex items-center justify-between text-xs text-white/50 pt-1">
          <div className="flex items-center gap-1.5 truncate">
            <Link
              href={
                initialData.mediaType === "anime"
                  ? "/anime"
                  : initialData.mediaType === "tv"
                  ? "/tv"
                  : "/movies"
              }
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Browse</span>
            </Link>
            <span>/</span>
            <span className="text-white/70 truncate max-w-[180px] sm:max-w-xs">{initialData.title}</span>
            {initialData.mediaType !== "movie" && (
              <>
                <span>/</span>
                <span className="text-emerald-400 font-bold">Ep {currentEpisode}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[11px] text-white/60">
              {initialData.status || "Streaming in HD"}
            </span>
          </div>
        </div>

        {/* ── RESPONSIVE 2-COLUMN LAYOUT (Aniflix Signature) ──────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ════════ LEFT COLUMN: PLAYER & PRIMARY MEDIA ════════ */}
          <div className="w-full lg:w-[67%] xl:w-[70%] 2xl:w-[72%] flex flex-col gap-3.5 min-w-0">
            {/* Player Container */}
            <div id="player-container" className="scroll-mt-20 relative z-30">
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
                totalEpisodes={initialData.episodesCount || initialData.totalEpisodes}
                onEpisodeChange={(s, e) => handleEpisodeChange(s, e)}
              />
            </div>

            {/* Upcoming Episode Countdown Banner (Aniflix Feature) */}
            {initialData.mediaType === "anime" && initialData.nextAiringEpisode && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0c0d12]/90 border border-white/[0.08] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        Episode {initialData.nextAiringEpisode.episode} Releases In
                      </h4>
                      <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                        Upcoming
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Scheduled for{" "}
                      {new Date(initialData.nextAiringEpisode.airingAt * 1000).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <UpcomingCountdownTimer targetTimestamp={initialData.nextAiringEpisode.airingAt} />
              </div>
            )}

            {/* Episode Title & Character/Series Header (Aniflix Style) */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-[#0c0d12]/90 border border-white/[0.08] backdrop-blur-xl shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-500/20 border border-emerald-500/40 shrink-0 flex items-center justify-center text-emerald-300 font-bold text-xs">
                    {initialData.posterPath ? (
                      <Image
                        src={initialData.posterPath}
                        alt=""
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      "SF"
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      {initialData.title}
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                      {initialData.mediaType !== "movie" && (
                        <span className="text-emerald-400 mr-1.5">
                          {currentEpisode < 10 ? `0${currentEpisode}` : currentEpisode} •
                        </span>
                      )}
                      {currentDisplayTitle}
                    </h2>
                  </div>
                </div>

                {/* Quick Rating Badge */}
                {initialData.voteAverage > 0 && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-xs">
                    <span>★ {initialData.voteAverage}</span>
                  </div>
                )}
              </div>

              {/* Action Toolbar (Aniflix Action Bar) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05] mt-1 text-xs">
                {/* Add to List */}
                <button
                  onClick={() => toggleWatchlist(initialData)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition cursor-pointer ${
                    isSaved
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/10"
                  }`}
                >
                  {isSaved ? <Check className="w-3.5 h-3.5 text-rose-400" /> : <Plus className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isSaved ? "In My List" : "Add to List"}</span>
                </button>

                {/* Quick Audio Cycle Button (Aniflix Feature) */}
                <button
                  onClick={handleQuickAudioCycle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 font-semibold transition cursor-pointer"
                  title="Click to cycle audio modes"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Audio:{" "}
                    <strong className="text-emerald-300 uppercase">
                      {initialData.mediaType === "anime" ? (audioMode === "dub" ? "ENG DUB" : "JAP SUB") : selectedLang.toUpperCase()}
                    </strong>
                  </span>
                </button>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition cursor-pointer"
                  title="Download episode"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download</span>
                </button>

                {/* Trailer Button */}
                {trailerVideo && (
                  <button
                    onClick={() => setShowTrailerModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 font-semibold transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span>Trailer</span>
                  </button>
                )}

                {/* Toggle Overview Accordion */}
                <button
                  onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/10 transition ml-auto cursor-pointer"
                >
                  <span>Overview</span>
                  {isOverviewExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Expandable Overview Accordion (Aniflix Style) */}
              {isOverviewExpanded && (
                <div className="pt-3 border-t border-white/[0.06] space-y-2.5 animate-fadeIn">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                    {initialData.releaseDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{initialData.releaseDate}</span>
                      </div>
                    )}
                    {initialData.runtime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{initialData.runtime} mins</span>
                      </div>
                    )}
                    {initialData.studios && initialData.studios.length > 0 && (
                      <div>Studio: <span className="text-white font-medium">{initialData.studios.join(", ")}</span></div>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal">
                    {initialData.overview || "No description provided for this title."}
                  </p>

                  {/* Genres */}
                  {initialData.genresList && initialData.genresList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {initialData.genresList.map((g) => (
                        <Link
                          key={g.id}
                          href={`/explore?genre=${encodeURIComponent(g.name)}`}
                          className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-emerald-500/15 text-white/70 hover:text-emerald-300 border border-white/5 transition"
                        >
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cast & Characters Section */}
            {initialData.cast && initialData.cast.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#0c0d12]/90 border border-white/[0.08] backdrop-blur-xl shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    {initialData.mediaType === "anime" ? "Characters & Voice Actors" : "Top Billed Cast"}
                  </h3>
                  <span className="text-[11px] text-white/40">{initialData.cast.length} Cast</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {initialData.cast.slice(0, 12).map((member) => (
                    <div
                      key={member.id}
                      className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center group"
                    >
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-zinc-800 mb-1.5 border border-white/10 group-hover:border-emerald-400 transition">
                        {member.profilePath ? (
                          <Image
                            src={member.profilePath}
                            alt={member.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-white/40 font-bold">
                            {member.name.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <h4 className="text-[11px] font-semibold text-white line-clamp-1 group-hover:text-emerald-300">
                        {member.name}
                      </h4>
                      <p className="text-[10px] text-white/40 line-clamp-1">{member.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Comments Section (Aniflix Style) */}
            <div className="p-4 rounded-2xl bg-[#0c0d12]/90 border border-white/[0.08] backdrop-blur-xl shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Discussion</h3>
                  <span className="px-2 py-0.2 rounded-full bg-white/[0.06] text-white/70 text-[10px] font-bold">
                    {comments.length}
                  </span>
                </div>
                <span className="text-[11px] text-white/40">Episode {currentEpisode}</span>
              </div>

              {/* Comment Input */}
              <form onSubmit={handlePostComment} className="flex gap-2">
                <input
                  type="text"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder={`Leave a comment on Episode ${currentEpisode}...`}
                  className="flex-1 bg-white/[0.04] focus:bg-white/[0.07] border border-white/10 focus:border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/30 outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!userComment.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-black text-xs font-bold transition cursor-pointer"
                >
                  Post
                </button>
              </form>

              {/* Comments List */}
              {comments.length === 0 ? (
                <div className="py-6 text-center text-white/40 text-xs">
                  Be the first to share your thoughts on Episode {currentEpisode}!
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {comments.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-300">{c.user}</span>
                        <span className="text-white/40">{c.time}</span>
                      </div>
                      <p className="text-xs text-white/80">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ════════ RIGHT COLUMN: EPISODE SELECTOR & SIDEBAR ════════ */}
          <div className="w-full lg:w-[33%] xl:w-[30%] 2xl:w-[28%] flex flex-col gap-5 shrink-0">
            {/* Episode Selector (Aniflix 3-View Component) */}
            {initialData.mediaType !== "movie" && (
              <div className="sticky top-20">
                <EpisodeSelector
                  mediaType={initialData.mediaType}
                  tmdbId={initialData.tmdbId}
                  seasons={initialData.seasons}
                  totalEpisodes={initialData.episodesCount || initialData.totalEpisodes || 12}
                  currentSeason={currentSeason}
                  currentEpisode={currentEpisode}
                  audioMode={audioMode}
                  onSelectEpisode={handleEpisodeChange}
                />
              </div>
            )}

            {/* Recommendations / Watch More From Franchise (Aniflix Sidebar) */}
            {initialData.recommendations && initialData.recommendations.length > 0 && (
              <div className="p-4 rounded-[22px] bg-[#0c0d12]/90 border border-white/[0.07] backdrop-blur-xl shadow-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">Recommended</h3>
                  <span className="text-[11px] text-emerald-400 font-semibold">More like this</span>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                  {initialData.recommendations.slice(0, 10).map((rec) => (
                    <Link
                      key={rec.id}
                      href={`/watch?type=${rec.mediaType}&id=${rec.anilistId || rec.tmdbId || rec.id}`}
                      className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 transition group cursor-pointer"
                    >
                      <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                        {rec.posterPath ? (
                          <Image
                            src={rec.posterPath}
                            alt={rec.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40">
                            {rec.title.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                          {rec.mediaType}
                        </span>
                        <h4 className="text-xs font-semibold text-white group-hover:text-emerald-300 truncate">
                          {rec.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                          {rec.releaseDate && <span>{rec.releaseDate.slice(0, 4)}</span>}
                          {rec.voteAverage > 0 && <span>★ {rec.voteAverage}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trailer Modal Popup */}
      {showTrailerModal && trailerVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                {trailerVideo.name || `${initialData.title} Official Trailer`}
              </span>
              <button
                onClick={() => setShowTrailerModal(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
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

      {/* Download Hub Modal */}
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
          if (!downloadStreamUrl) return;
          if (
            downloadStreamUrl.startsWith("https://zokoanime.video/download/") ||
            downloadStreamUrl.startsWith("https://vidvault.to/")
          ) {
            import("@capacitor/core")
              .then(async ({ Capacitor }) => {
                if (Capacitor.isNativePlatform()) {
                  const { Browser } = await import("@capacitor/browser");
                  await Browser.open({ url: downloadStreamUrl });
                  return;
                }
                const a = document.createElement("a");
                a.href = downloadStreamUrl;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              })
              .catch(() => {
                window.location.href = downloadStreamUrl;
              });
            return;
          }
          const filename = `${initialData.title.replace(/[^\w\s-]/g, "")}_${
            initialData.mediaType === "movie" ? "Movie" : `S${currentSeason}E${currentEpisode}`
          }_1080p.mp4`;
          triggerBrowserDownload(downloadStreamUrl, filename);
        }}
      />
    </div>
  );
}
