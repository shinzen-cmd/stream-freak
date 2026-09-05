"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, History, Trash2, Play, Sparkles, Film, ArrowRight } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";
import MediaCard from "@/components/MediaCard";

export default function WatchlistPage() {
  const {
    watchlist,
    continueWatching,
    removeFromWatchlist,
    removeFromHistory,
    clearHistory,
  } = useWatchlist();

  const [activeTab, setActiveTab] = useState<"watchlist" | "history">("watchlist");

  return (
    <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 pt-20 xs:pt-24 sm:pt-28 pb-20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 xs:mb-8">
        <div>
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
            <Bookmark className="w-4 h-4" /> Personal Library
          </span>
          <h1 className="text-2xl sm:text-4xl 3xl:text-5xl font-black text-white">
            My <span className="gradient-text">Collection</span>
          </h1>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 xs:gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "watchlist"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <span>Watchlist ({watchlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <History className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <span>Watch History ({continueWatching.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Watchlist */}
      {activeTab === "watchlist" && (
        <div>
          {watchlist.length === 0 ? (
            <div className="glass-panel rounded-3xl border border-white/10 p-8 sm:p-12 text-center max-w-lg mx-auto my-8 xs:my-12">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your Watchlist is Empty</h3>
              <p className="text-sm text-gray-400 mb-6">
                Explore thousands of movies, TV shows, and anime to build your personalized watchlist.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-lg shadow-cyan-500/25 transition"
              >
                <span>Browse Titles</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-2.5 xs:gap-3.5 sm:gap-4 lg:gap-6">
              {watchlist.map((item) => (
                <MediaCard key={`${item.mediaType}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Watch History */}
      {activeTab === "history" && (
        <div>
          {continueWatching.length === 0 ? (
            <div className="glass-panel rounded-3xl border border-white/10 p-8 sm:p-12 text-center max-w-lg mx-auto my-8 xs:my-12">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Playback History Yet</h3>
              <p className="text-sm text-gray-400 mb-6">
                As soon as you stream any movie, series episode, or anime, it will appear here so you can pick up right where you left off.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold text-sm shadow-lg shadow-purple-500/25 transition"
              >
                <span>Start Watching</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All History</span>
                </button>
              </div>

              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-2.5 xs:gap-3.5 sm:gap-4 3xl:gap-6">
                {continueWatching.map((item) => {
                  const watchUrl = `/watch?type=${item.mediaType}&id=${item.id}${
                    item.seasonNumber ? `&s=${item.seasonNumber}` : ""
                  }${item.episodeNumber ? `&e=${item.episodeNumber}` : ""}`;

                  return (
                    <div
                      key={`${item.mediaType}-${item.id}`}
                      className="group rounded-2xl overflow-hidden glass-panel border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
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
                          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-gray-400">
                            {item.title}
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg shadow-cyan-500/40">
                            <Play className="w-6 h-6 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-rose-500"
                            style={{ width: `${item.progressPercent || 50}%` }}
                          />
                        </div>
                      </Link>

                      <div className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              item.mediaType === "movie"
                                ? "bg-blue-500/20 text-blue-400"
                                : item.mediaType === "tv"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-purple-500/20 text-purple-400"
                            }`}
                          >
                            {item.mediaType}
                          </span>
                          <h4 className="text-sm font-semibold text-white truncate mt-1 group-hover:text-cyan-400 transition">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {item.mediaType === "movie"
                              ? "Full Movie"
                              : item.episodeTitle
                              ? `${item.seasonNumber ? `S${item.seasonNumber} ` : ""}E${item.episodeNumber}: ${item.episodeTitle}`
                              : `${item.seasonNumber ? `Season ${item.seasonNumber} ` : ""}Episode ${item.episodeNumber || 1}`}
                          </p>
                        </div>

                        <button
                          onClick={() => removeFromHistory(item.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition"
                          title="Remove from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
