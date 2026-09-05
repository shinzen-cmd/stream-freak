"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Check, Star, Info, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { MediaItem } from "@/types/media";
import { useWatchlist } from "@/context/WatchlistContext";

interface HeroBannerProps {
  items: MediaItem[];
}

export default function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  // Keep intervalRef so we can reset it on manual navigation
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const featured = items.slice(0, 6);

  /**
   * Starts (or restarts) the auto-slide interval.
   * Calling this on manual nav resets the 7s countdown,
   * preventing an immediate slide right after the user clicks.
   */
  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPaused || featured.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 7000);
  }, [isPaused, featured.length]);

  // Start interval on mount and when pause state changes
  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startInterval]);

  // Manual navigation — always resets the timer
  const goTo = useCallback(
    (idx: number) => {
      setCurrentIndex(idx);
      startInterval(); // reset countdown
    },
    [startInterval]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + featured.length) % featured.length);
    startInterval();
  }, [featured.length, startInterval]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % featured.length);
    startInterval();
  }, [featured.length, startInterval]);

  if (!featured || featured.length === 0) return null;

  const currentItem = featured[currentIndex];
  const isSaved = isInWatchlist(currentItem.id);

  const watchUrl = `/watch?type=${currentItem.mediaType}&id=${
    currentItem.anilistId || currentItem.tmdbId || currentItem.id
  }`;

  return (
    <div
      className="relative w-full h-[65vh] xs:h-[70vh] sm:h-[75vh] 3xl:h-[80vh] min-h-[460px] xs:min-h-[500px] sm:min-h-[560px] max-h-[750px] 3xl:max-h-[1000px] 4xl:max-h-[1200px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image Carousel */}
      {featured.map((item, idx) => (
        <div
          key={`${item.mediaType}-${item.id}`}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          {item.backdropPath ? (
            <Image
              src={item.backdropPath}
              alt={item.title}
              fill
              priority={idx === 0}
              sizes="100vw"
              className="object-cover object-center transform scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900" />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/80 to-transparent w-full md:w-3/4" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090a0f]/70 via-transparent to-[#090a0f]" />
        </div>
      ))}

      {/* Hero Content Overlay */}
      <div className="relative z-20 max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto h-full px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 flex flex-col justify-center pb-10 sm:pb-12">
        <div className="max-w-xl sm:max-w-2xl 3xl:max-w-4xl space-y-3 xs:space-y-4 sm:space-y-5 animate-fadeIn">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 xs:gap-2.5">
            <span className="text-[10px] xs:text-xs 3xl:text-sm font-extrabold uppercase tracking-wider px-2.5 py-0.5 xs:px-3 xs:py-1 rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-950/40">
              Featured {currentItem.mediaType}
            </span>

            {currentItem.voteAverage > 0 && (
              <span className="text-[10px] xs:text-xs 3xl:text-sm font-bold px-2 py-0.5 xs:px-2.5 xs:py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-amber-400/20">
                {currentItem.voteAverage} Rating
              </span>
            )}

            {currentItem.releaseDate && (
              <span className="text-[10px] xs:text-xs 3xl:text-sm font-semibold px-2 py-0.5 xs:px-2.5 xs:py-1 rounded-full bg-white/10 backdrop-blur-md text-gray-300 border border-white/10">
                {currentItem.releaseDate.slice(0, 4)}
              </span>
            )}

            {currentItem.totalEpisodes && (
              <span className="text-[10px] xs:text-xs 3xl:text-sm font-semibold px-2 py-0.5 xs:px-2.5 xs:py-1 rounded-full bg-white/10 backdrop-blur-md text-purple-300 border border-white/10">
                {currentItem.totalEpisodes} Episodes
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl min-[360px]:text-3xl sm:text-5xl lg:text-6xl 3xl:text-7xl font-black text-white tracking-tight leading-tight drop-shadow-md line-clamp-2">
            {currentItem.title}
          </h1>

          {/* Overview */}
          <p className="text-xs xs:text-sm sm:text-base 3xl:text-xl text-gray-300 line-clamp-2 xs:line-clamp-3 max-w-xl 3xl:max-w-3xl font-normal drop-shadow">
            {currentItem.overview}
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 xs:gap-3 pt-1 xs:pt-2">
            <Link
              href={watchUrl}
              className="flex items-center gap-1.5 xs:gap-2 px-4 py-2.5 xs:px-5 xs:py-3 sm:px-6 sm:py-3.5 3xl:px-8 3xl:py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs xs:text-sm 3xl:text-base shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 xs:w-5 xs:h-5 fill-current" />
              <span>Watch Now</span>
            </Link>

            <button
              onClick={() => toggleWatchlist(currentItem)}
              className={`flex items-center gap-1.5 xs:gap-2 px-3.5 py-2.5 xs:px-4 xs:py-3 sm:px-5 sm:py-3.5 3xl:px-7 3xl:py-4 rounded-xl text-xs xs:text-sm 3xl:text-base font-semibold backdrop-blur-md transition-all duration-200 border ${
                isSaved
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 xs:w-5 xs:h-5 text-rose-400" />
                  <span>In Watchlist</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 xs:w-5 xs:h-5" />
                  <span>Add Watchlist</span>
                </>
              )}
            </button>

            <Link
              href={watchUrl}
              className="flex items-center gap-1.5 xs:gap-2 px-3 py-2.5 xs:px-4 xs:py-3 sm:px-4 sm:py-3.5 3xl:px-6 3xl:py-4 rounded-xl text-xs xs:text-sm 3xl:text-base font-medium text-gray-300 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 transition"
            >
              <Info className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-cyan-400" />
              <span>Details</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Slide Navigation Controls & Indicators */}
      <div className="absolute bottom-4 xs:bottom-6 right-3 xs:right-4 sm:right-8 z-30 flex items-center gap-2 xs:gap-3">
        <button
          onClick={goPrev}
          className="p-1.5 xs:p-2 rounded-full bg-black/60 border border-white/10 text-white hover:bg-cyan-500 hover:text-black transition"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
        </button>

        <div className="flex items-center gap-1 xs:gap-1.5">
          {featured.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`h-1.5 xs:h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex ? "w-5 xs:w-7 bg-cyan-400" : "w-1.5 xs:w-2 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="p-1.5 xs:p-2 rounded-full bg-black/60 border border-white/10 text-white hover:bg-cyan-500 hover:text-black transition"
          aria-label="Next slide"
        >
          <ChevronRight className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
        </button>
      </div>
    </div>
  );
}
