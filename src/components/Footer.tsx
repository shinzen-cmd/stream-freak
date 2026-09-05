import React from "react";
import Link from "next/link";
import Image from "next/image";
import { PlaySquare, Film, Tv, Clapperboard, Compass, Bookmark, Flame } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 xs:mt-20 3xl:mt-28 border-t border-white/10 bg-black/70 backdrop-blur-md pb-[max(2rem,env(safe-area-inset-bottom,1rem))]">
      <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 py-8 xs:py-12 3xl:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-cyan-500/20">
                <Image
                  src="/app-icon.svg"
                  alt="Stream Freak Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                STREAM <span className="gradient-text ml-1">FREAK</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400 max-w-sm">
              Your ultimate streaming destination for Movies, TV Series, and Anime.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Explore</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/movies" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" /> Movies
                </Link>
              </li>
              <li>
                <Link href="/bollywood" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> Bollywood
                </Link>
              </li>
              <li>
                <Link href="/tv" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" /> TV Shows
                </Link>
              </li>
              <li>
                <Link href="/anime" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Clapperboard className="w-3.5 h-3.5" /> Anime
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Discover
                </Link>
              </li>
            </ul>
          </div>

          {/* Library & Tools */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Library</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/watchlist" className="hover:text-cyan-400 transition flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" /> My Watchlist
                </Link>
              </li>
              <li>
                <Link href="/watchlist" className="hover:text-cyan-400 transition">
                  Continue Watching
                </Link>
              </li>
              <li>
                <Link href="/explore?sort=vote_average.desc" className="hover:text-cyan-400 transition">
                  Top Rated
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p suppressHydrationWarning>© 2026 Stream Freak. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-400 transition">
              Home
            </Link>
            <span>•</span>
            <Link href="/explore" className="hover:text-gray-400 transition">
              Browse
            </Link>
            <span>•</span>
            <Link href="/watchlist" className="hover:text-gray-400 transition">
              Watchlist
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
