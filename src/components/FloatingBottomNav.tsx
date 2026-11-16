"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tv, Compass, Bookmark, Search } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";
import ExploreDrawer from "./ExploreDrawer";

export default function FloatingBottomNav() {
  const pathname = usePathname();
  const { openSearch, watchlist } = useWatchlist();
  const [mounted, setMounted] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Floating Pill Container (Mobile only — hidden on PC/TV where top Navbar shows all links) */}
      <nav
        aria-label="Bottom Navigation"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 bg-[#0a0a0c]/85 backdrop-blur-2xl border border-white/10 rounded-full px-4 sm:px-6 py-2 flex items-center gap-5 sm:gap-7 shadow-2xl shadow-black/80 select-none"
      >
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            pathname === "/" ? "text-emerald-400 font-bold" : "text-white/50 hover:text-white"
          }`}
          title="Home"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] hidden xs:inline tracking-tight">Home</span>
        </Link>

        {/* Anime / Series */}
        <Link
          href="/anime"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            pathname === "/anime" ? "text-emerald-400 font-bold" : "text-white/50 hover:text-white"
          }`}
          title="Anime"
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] hidden xs:inline tracking-tight">Anime</span>
        </Link>

        {/* Center Floating Action Button (Explore Menu Trigger) */}
        <button
          onClick={() => setExploreOpen(true)}
          className="relative -my-3.5 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black flex items-center justify-center shadow-lg shadow-emerald-500/35 transition-all cursor-pointer group"
          title="Explore genres, random anime, & schedule"
          aria-label="Open Explore Menu"
        >
          <Compass className="w-6 h-6 group-hover:rotate-45 transition-transform duration-300" />
        </button>

        {/* Watchlist / My List */}
        <Link
          href="/watchlist"
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            pathname === "/watchlist" ? "text-emerald-400 font-bold" : "text-white/50 hover:text-white"
          }`}
          title="Watchlist"
        >
          <div className="relative">
            <Bookmark className="w-5 h-5" />
            {mounted && watchlist.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 flex items-center justify-center text-[9px] font-bold bg-emerald-500 text-black rounded-full shadow-sm">
                {watchlist.length}
              </span>
            )}
          </div>
          <span className="text-[10px] hidden xs:inline tracking-tight">My List</span>
        </Link>

        {/* Search */}
        <button
          onClick={openSearch}
          className="flex flex-col items-center justify-center gap-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Search anime, movies, genres"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] hidden xs:inline tracking-tight">Search</span>
        </button>
      </nav>

      {/* Explore Drawer */}
      <ExploreDrawer isOpen={exploreOpen} onClose={() => setExploreOpen(false)} />
    </>
  );
}
