"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Film, Tv, Clapperboard, Compass, Bookmark, Search, Menu, X, PlaySquare, Flame } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";

export default function Navbar() {
  const pathname = usePathname();
  const { openSearch, watchlist } = useWatchlist();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/", icon: PlaySquare },
    { name: "Movies", href: "/movies", icon: Film },
    { name: "Bollywood", href: "/bollywood", icon: Flame },
    { name: "TV Shows", href: "/tv", icon: Tv },
    { name: "Anime", href: "/anime", icon: Clapperboard },
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Watchlist", href: "/watchlist", icon: Bookmark, badge: mounted ? watchlist.length : 0 },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 pt-[env(safe-area-inset-top,0px)] ${
          isScrolled ? "glass-nav shadow-lg shadow-black/40" : "bg-gradient-to-b from-black/95 via-black/50 to-transparent"
        }`}
      >
        <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12">
          <div className="flex items-center justify-between h-14 xs:h-16 md:h-20 3xl:h-24">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2 xs:gap-2.5 group shrink-0">
              <div className="relative w-8 h-8 xs:w-10 xs:h-10 3xl:w-12 3xl:h-12 rounded-xl overflow-hidden shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 group-hover:scale-105 transition-all">
                <Image
                  src="/app-icon.svg"
                  alt="Stream Freak Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-base xs:text-xl 3xl:text-2xl font-extrabold tracking-tight text-white font-sans flex items-center">
                  STREAM <span className="gradient-text ml-1">FREAK</span>
                </span>
                <span className="text-[8px] xs:text-[9px] 3xl:text-xs uppercase tracking-widest text-cyan-400/80 -mt-0.5 font-semibold hidden min-[340px]:inline-block">
                  Movies • TV • Anime
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2 3xl:gap-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`relative flex items-center gap-2 px-3 py-1.5 lg:px-3.5 lg:py-2 3xl:px-5 3xl:py-2.5 rounded-xl text-sm 3xl:text-base font-medium transition-all ${
                      isActive
                        ? "text-white bg-white/10 shadow-sm"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className={`w-4 h-4 3xl:w-5 3xl:h-5 ${isActive ? "text-emerald-400" : "text-gray-400"}`} />
                    <span>{link.name}</span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] 3xl:text-xs font-bold bg-rose-500 text-white rounded-full">
                        {link.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-emerald-500 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right Action Icons */}
            <div className="flex items-center gap-1.5 xs:gap-3">
              {/* Search Trigger */}
              <button
                onClick={openSearch}
                className="flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3 py-1.5 3xl:px-4 3xl:py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition group text-xs 3xl:text-sm"
                aria-label="Search"
              >
                <Search className="w-3.5 h-3.5 xs:w-4 xs:h-4 3xl:w-5 3xl:h-5 text-cyan-400 group-hover:scale-110 transition" />
                <span className="hidden sm:inline-block">Search</span>
                <kbd className="hidden sm:inline-block text-[10px] 3xl:text-xs px-1.5 py-0.5 bg-white/10 rounded text-gray-400 border border-white/5">
                  ⌘K
                </kbd>
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 xs:p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-white/10 px-4 py-4 space-y-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? "text-white bg-cyan-500/20 border border-cyan-500/30 font-semibold"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? "text-cyan-400" : "text-gray-400"}`} />
                    <span>{link.name}</span>
                  </div>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </header>
    </>
  );
}
