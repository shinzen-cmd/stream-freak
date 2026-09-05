"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { History, Play, Trash2 } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";

export default function ContinueWatchingRow() {
  const { continueWatching, removeFromHistory, clearHistory } = useWatchlist();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !continueWatching || continueWatching.length === 0) {
    return null;
  }

  return (
    <section className="my-6 xs:my-8 3xl:my-12 max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12">
      <div className="flex items-center justify-between mb-3 xs:mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 xs:w-5 xs:h-5 text-cyan-400" />
          <h2 className="text-lg xs:text-xl sm:text-2xl 3xl:text-3xl font-bold text-white">Continue Watching</h2>
        </div>
        <button
          onClick={clearHistory}
          className="text-xs 3xl:text-sm text-gray-400 hover:text-rose-400 transition flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-2.5 xs:gap-3.5 sm:gap-4 3xl:gap-6">
        {continueWatching.slice(0, 6).map((item) => {
          const watchUrl = `/watch?type=${item.mediaType}&id=${item.id}${
            item.seasonNumber ? `&s=${item.seasonNumber}` : ""
          }${item.episodeNumber ? `&e=${item.episodeNumber}` : ""}`;

          return (
            <div
              key={`${item.mediaType}-${item.id}`}
              className="group relative rounded-xl overflow-hidden glass-panel border border-white/10 hover:border-cyan-500/50 transition-all duration-300"
            >
              <Link href={watchUrl} className="block relative aspect-video bg-gray-900 overflow-hidden">
                {item.backdropPath || item.posterPath ? (
                  <Image
                    src={item.backdropPath || item.posterPath!}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-gray-500">
                    {item.title}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg shadow-cyan-500/40">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${item.progressPercent || 40}%` }}
                  />
                </div>
              </Link>

              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-400 truncate">
                    {item.mediaType === "movie"
                      ? "Movie"
                      : item.episodeTitle
                      ? `${item.seasonNumber ? `S${item.seasonNumber} ` : ""}E${item.episodeNumber}: ${item.episodeTitle}`
                      : `${item.seasonNumber ? `Season ${item.seasonNumber} ` : ""}Episode ${item.episodeNumber || 1}`}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeFromHistory(item.id);
                  }}
                  className="text-gray-500 hover:text-rose-400 p-1 transition"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
