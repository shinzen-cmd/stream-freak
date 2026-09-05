"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Bookmark, Play, Plus, Check } from "lucide-react";
import { MediaItem } from "@/types/media";
import { useWatchlist } from "@/context/WatchlistContext";

interface MediaCardProps {
  item: MediaItem;
  priority?: boolean;
  progressPercent?: number;
}

export default function MediaCard({ item, priority = false, progressPercent }: MediaCardProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const isSaved = isInWatchlist(item.id);

  const watchUrl = `/watch?type=${item.mediaType}&id=${item.anilistId || item.tmdbId || item.id}`;

  const mediaTypeColor =
    item.mediaType === "movie"
      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
      : item.mediaType === "tv"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-purple-500/20 text-purple-300 border-purple-500/40";

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[#12151f] border border-white/5 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-cyan-500/10 hover:border-white/20">
      {/* Poster Image Container */}
      <Link href={watchUrl} className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900 block">
        {item.posterPath ? (
          <Image
            src={item.posterPath}
            alt={item.title}
            fill
            sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, (max-width: 1920px) 16vw, 12vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400 text-xs p-2 text-center">
            {item.title}
          </div>
        )}

        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500/90 text-black flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-cyan-500/40">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </div>

        {/* Top Badges: Media Type & Rating */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md backdrop-blur-md border ${mediaTypeColor}`}
          >
            {item.mediaType}
          </span>
          {item.voteAverage > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-amber-300 border border-amber-400/20">
              {item.voteAverage}
            </span>
          )}
        </div>

        {/* Continue Watching Progress Bar */}
        {progressPercent !== undefined && progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-rose-500"
              style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
            />
          </div>
        )}
      </Link>

      {/* Card Info Details */}
      <div className="p-2.5 xs:p-3 flex flex-col flex-1 justify-between gap-1.5 xs:gap-2">
        <div>
          <Link href={watchUrl} className="block">
            <h3 className="text-xs xs:text-sm font-semibold text-white line-clamp-1 group-hover:text-cyan-400 transition">
              {item.title}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 xs:gap-2 mt-0.5 xs:mt-1 text-[11px] xs:text-xs text-gray-400">
            {item.releaseDate && <span>{item.releaseDate.slice(0, 4)}</span>}
            {item.totalEpisodes && (
              <>
                <span>•</span>
                <span>{item.totalEpisodes} Eps</span>
              </>
            )}
            {item.genres && item.genres.length > 0 && (
              <>
                <span>•</span>
                <span className="truncate max-w-[80px] xs:max-w-[100px]">{item.genres[0]}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleWatchlist(item);
            }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 min-h-[32px] xs:min-h-[34px] rounded-lg border transition ${
              isSaved
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Watchlist</span>
              </>
            )}
          </button>

          <Link
            href={watchUrl}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-0.5 hover:underline py-1.5 min-h-[32px] xs:min-h-[34px]"
          >
            Stream &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
