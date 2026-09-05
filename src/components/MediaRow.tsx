"use client";

import React, { useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Tv,
  Film,
  Star,
  Trophy,
  Calendar,
  Radio,
  Heart,
} from "lucide-react";
import { MediaItem } from "@/types/media";
import MediaCard from "./MediaCard";

export type IconType =
  | "flame"
  | "sparkles"
  | "tv"
  | "film"
  | "star"
  | "trophy"
  | "calendar"
  | "radio"
  | "heart";

interface MediaRowProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  viewAllHref?: string;
  iconName?: IconType;
}

export default function MediaRow({ title, subtitle, items, viewAllHref, iconName }: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!items || items.length === 0) return null;

  const renderIcon = () => {
    switch (iconName) {
      case "flame":
        return <Flame className="w-5 h-5 text-cyan-400" />;
      case "sparkles":
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      case "tv":
        return <Tv className="w-5 h-5 text-cyan-400" />;
      case "film":
        return <Film className="w-5 h-5 text-cyan-400" />;
      case "star":
        return <Star className="w-5 h-5 text-cyan-400" />;
      case "trophy":
        return <Trophy className="w-5 h-5 text-cyan-400" />;
      case "calendar":
        return <Calendar className="w-5 h-5 text-cyan-400" />;
      case "radio":
        return <Radio className="w-5 h-5 text-cyan-400" />;
      case "heart":
        return <Heart className="w-5 h-5 text-cyan-400" />;
      default:
        return null;
    }
  };

  // Render title with matte emerald styling on key words like "Movies", "Anime", "Series", "Shows", "Bollywood"
  const renderFormattedTitle = (rawTitle: string) => {
    const parts = rawTitle.split(/\b(Movies|Anime|TV Shows|TV Series|Bollywood)\b/gi);
    return parts.map((part, idx) => {
      if (/^(movies|anime|tv shows|tv series|bollywood)$/i.test(part)) {
        return (
          <span key={idx} className="text-emerald-400 font-extrabold tracking-tight">
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <section className="my-6 xs:my-8 3xl:my-12 relative group/row">
      {/* Row Header */}
      <div className="flex items-end justify-between max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 mb-3 xs:mb-4">
        <div>
          {subtitle && (
            <span className="text-[10px] xs:text-xs 3xl:text-sm uppercase tracking-wider text-emerald-500/80 font-semibold mb-0.5 xs:mb-1 block">
              {subtitle}
            </span>
          )}
          <h2 className="text-lg xs:text-xl sm:text-2xl 3xl:text-3xl font-bold text-white flex items-center gap-1.5 xs:gap-2">
            <span>{renderFormattedTitle(title)}</span>
          </h2>
        </div>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs sm:text-sm 3xl:text-base text-emerald-400 hover:text-emerald-300 font-medium transition hover:underline shrink-0"
          >
            Explore All &rarr;
          </Link>
        )}
      </div>

      {/* Horizontal Carousel Container */}
      <div className="relative max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto">
        {/* Left Arrow Button */}
        <button
          onClick={() => handleScroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 xs:w-10 xs:h-10 3xl:w-12 3xl:h-12 rounded-full bg-black/80 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-cyan-500 hover:text-black transition-all duration-300 shadow-xl backdrop-blur-md hidden sm:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 3xl:w-7 3xl:h-7" />
        </button>

        {/* Media Items Track */}
        <div
          ref={rowRef}
          className="flex items-stretch gap-2.5 xs:gap-3.5 sm:gap-4 3xl:gap-6 overflow-x-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 pb-4 no-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          {items.map((item, index) => (
            <div
              key={`${item.mediaType}-${item.id}-${index}`}
              className="w-[135px] min-[360px]:w-[150px] xs:w-[165px] sm:w-[190px] md:w-[210px] lg:w-[225px] 2xl:w-[250px] 3xl:w-[290px] 4xl:w-[340px] shrink-0 snap-start"
            >
              <MediaCard item={item} />
            </div>
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => handleScroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 xs:w-10 xs:h-10 3xl:w-12 3xl:h-12 rounded-full bg-black/80 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-cyan-500 hover:text-black transition-all duration-300 shadow-xl backdrop-blur-md hidden sm:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 3xl:w-7 3xl:h-7" />
        </button>
      </div>
    </section>
  );
}
