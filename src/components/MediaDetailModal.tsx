"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  X, Play, Plus, Check, Star, Calendar, Clock, Film, Tv, Sparkles, 
  Loader2 
} from "lucide-react";
import { MediaItem, MediaDetail } from "@/types/media";
import { getMediaDetails } from "@/lib/mediaService";
import { useWatchlist } from "@/context/WatchlistContext";

interface MediaDetailModalProps {
  item: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: () => void;
}

export default function MediaDetailModal({ item, isOpen, onClose, onPlay }: MediaDetailModalProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getMediaDetails(item.anilistId || item.tmdbId || item.id, item.mediaType)
      .then((data) => {
        if (!isMounted) return;
        setDetail(data);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const currentItem = detail || item;
  const isSaved = isInWatchlist(currentItem.id);
  const targetId = currentItem.anilistId || currentItem.tmdbId || currentItem.id;
  const watchUrl = `/watch?type=${currentItem.mediaType}&id=${targetId}&play=true`;

  const bannerImg = currentItem.backdropPath || currentItem.bannerImage || currentItem.posterPath;

  const mediaTypeColor =
    currentItem.mediaType === "movie"
      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
      : currentItem.mediaType === "tv"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-purple-500/20 text-purple-300 border-purple-500/40";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl 2xl:max-w-4xl glass-panel rounded-2xl xs:rounded-3xl shadow-2xl border border-white/10 overflow-hidden z-10 flex flex-col my-auto max-h-[90vh] bg-[#0c0e17]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 p-2 rounded-full bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white border border-white/10 transition backdrop-blur-md"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Header with Backdrop */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full max-h-[320px] sm:max-h-[380px] overflow-hidden bg-gray-900 shrink-0">
          {bannerImg ? (
            <Image
              src={bannerImg}
              alt={currentItem.title}
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e17] via-[#0c0e17]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e17]/90 via-[#0c0e17]/40 to-transparent w-3/4" />

          {/* Bottom Title & Actions on Banner */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-20 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] xs:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md backdrop-blur-md border ${mediaTypeColor}`}>
                {currentItem.mediaType}
              </span>
              {currentItem.voteAverage > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-amber-300 border border-amber-400/20">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{currentItem.voteAverage}</span>
                </div>
              )}
              {currentItem.releaseDate && (
                <span className="text-xs text-gray-300 font-medium px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/10">
                  {currentItem.releaseDate.slice(0, 4)}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
              {currentItem.title}
            </h2>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href={watchUrl}
                onClick={() => {
                  if (onPlay) onPlay();
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Now</span>
              </Link>

              <button
                onClick={() => toggleWatchlist(currentItem)}
                className={`flex items-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold border backdrop-blur-md transition-all ${
                  isSaved
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                    : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 text-rose-400" />
                    <span>In Watchlist</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Watchlist</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 xs:space-y-5 no-scrollbar">
          {loading && (
            <div className="flex items-center justify-center py-4 text-cyan-400 gap-2 text-xs font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching full synopsis & cast...</span>
            </div>
          )}

          {/* Overview / Storyline */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Synopsis</h3>
            <p className="text-sm text-gray-300 leading-relaxed font-normal">
              {currentItem.overview || "No synopsis available for this title."}
            </p>
          </div>

          {/* Quick Metrics & Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/5 text-xs text-gray-300">
            {detail?.runtime ? (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Duration</span>
                <span className="font-semibold text-white">{detail.runtime} mins</span>
              </div>
            ) : null}

            {currentItem.totalEpisodes ? (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Episodes</span>
                <span className="font-semibold text-white">{currentItem.totalEpisodes} Total</span>
              </div>
            ) : null}

            {currentItem.status ? (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Status</span>
                <span className="font-semibold text-white">{currentItem.status}</span>
              </div>
            ) : null}

            {currentItem.originalTitle && currentItem.originalTitle !== currentItem.title ? (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Original Title</span>
                <span className="font-semibold text-white truncate block">{currentItem.originalTitle}</span>
              </div>
            ) : null}
          </div>

          {/* Genres Badges */}
          {(detail?.genresList?.length || currentItem.genres?.length) ? (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Genres</h3>
              <div className="flex flex-wrap gap-1.5">
                {(detail?.genresList ? detail.genresList.map(g => g.name) : (currentItem.genres || [])).map((gName, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium"
                  >
                    {gName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Top Billed Cast */}
          {detail?.cast && detail.cast.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {currentItem.mediaType === "anime" ? "Characters & Voice Actors" : "Featured Cast"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {detail.cast.slice(0, 8).map((actor) => (
                  <div
                    key={actor.id}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                      {actor.profilePath ? (
                        <Image
                          src={actor.profilePath}
                          alt={actor.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 font-bold">
                          {actor.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{actor.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{actor.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

