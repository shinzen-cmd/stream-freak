"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Flame, Star, Calendar, Shuffle, Compass } from "lucide-react";

interface ExploreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Dark Fantasy",
  "Fantasy",
  "Isekai",
  "Horror",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Shounen",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Suspense",
  "Thriller",
];

const POPULAR_RANDOM_IDS = [
  { id: 21, type: "anime", title: "One Piece" },
  { id: 117193, type: "anime", title: "My Hero Academia" },
  { id: 101922, type: "anime", title: "Demon Slayer" },
  { id: 113415, type: "anime", title: "Jujutsu Kaisen" },
  { id: 151807, type: "anime", title: "Solo Leveling" },
  { id: 16498, type: "anime", title: "Attack on Titan" },
  { id: 127230, type: "anime", title: "Chainsaw Man" },
  { id: 11061, type: "anime", title: "Hunter x Hunter" },
];

export default function ExploreDrawer({ isOpen, onClose }: ExploreDrawerProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleRandomAnime = () => {
    const pick = POPULAR_RANDOM_IDS[Math.floor(Math.random() * POPULAR_RANDOM_IDS.length)];
    onClose();
    router.push(`/watch?type=${pick.type}&id=${pick.id}&play=true`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in transition-opacity"
      />

      {/* Drawer Surface */}
      <div className="relative w-full sm:max-w-xl md:max-w-2xl bg-[#0a0a0c]/95 border border-white/10 rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl backdrop-blur-2xl z-10 max-h-[85vh] overflow-y-auto no-scrollbar animate-slide-up sm:animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">Explore &amp; Discover</h3>
              <p className="text-[11px] text-white/50">Quick access to categories, schedule &amp; genres</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition border border-white/5"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Column Quick Access Grid (Aniflix Style) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5">
          <Link
            href="/explore"
            onClick={onClose}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/30 text-center transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300">Trending</span>
            <span className="text-[10px] text-white/40">Most watched</span>
          </Link>

          <Link
            href="/anime"
            onClick={onClose}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/30 text-center transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
              <Star className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300">Top Rated</span>
            <span className="text-[10px] text-white/40">Highest score</span>
          </Link>

          <Link
            href="/anime"
            onClick={onClose}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/30 text-center transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300">Schedule</span>
            <span className="text-[10px] text-white/40">Airing weekly</span>
          </Link>

          <button
            onClick={handleRandomAnime}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/30 text-center transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-110 transition-transform">
              <Shuffle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300">Random</span>
            <span className="text-[10px] text-white/40">Surprise pick</span>
          </button>
        </div>

        {/* Genre Chips Grid (Aniflix Style) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Browse by Genre</h4>
            <span className="text-[10px] text-emerald-400 font-semibold">{GENRES.length} Categories</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <Link
                key={genre}
                href={`/explore?genre=${encodeURIComponent(genre)}`}
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-emerald-500/15 hover:border-emerald-500/40 text-xs font-medium text-white/75 hover:text-emerald-300 border border-white/5 transition-all shadow-sm"
              >
                {genre}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
