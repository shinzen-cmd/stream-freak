import React from "react";
import HeroBanner from "@/components/HeroBanner";
import MediaRow from "@/components/MediaRow";
import Link from "next/link";
import { getBollywoodMovies, getBollywoodSeries, getTopRatedBollywoodMovies, discoverMovies, getHollywoodHindiDubbedMovies } from "@/lib/tmdb";
import { Flame, Star, Sparkles, Film, Heart } from "lucide-react";

export default async function BollywoodPage() {
  const [
    bollywoodTrending,
    bollywoodSeries,
    topRatedBollywood,
    hollywoodHindiDubbed,
    actionBollywood,
    romanceBollywood,
  ] = await Promise.all([
    getBollywoodMovies(1).catch(() => []),
    getBollywoodSeries(1).catch(() => []),
    getTopRatedBollywoodMovies(1).catch(() => []),
    getHollywoodHindiDubbedMovies(1).catch(() => []),
    discoverMovies({ genreId: 28, year: 2024 }).then((d) => d.items).catch(() => []),
    discoverMovies({ genreId: 10749 }).then((d) => d.items).catch(() => []),
  ]);

  const heroItems = bollywoodTrending.slice(0, 5);

  const bollywoodGenres = [
    { name: "Action", id: 28 },
    { name: "Romance", id: 10749 },
    { name: "Comedy", id: 35 },
    { name: "Drama", id: 18 },
    { name: "Thriller", id: 53 },
    { name: "Crime", id: 80 },
  ];

  return (
    <div className="min-h-screen pb-16">
      {/* Featured Banner */}
      <HeroBanner items={heroItems.length > 0 ? heroItems : bollywoodTrending} />

      {/* Genre Pills */}
      <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 -mt-4 xs:-mt-6 relative z-30 mb-6 xs:mb-8">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar border border-white/10">
          <span className="text-xs uppercase font-bold text-emerald-400 shrink-0 mr-2">
            Desi Genres:
          </span>
          <Link
            href="/explore?type=movie"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-semibold shrink-0 shadow-sm"
          >
            All Hindi Content
          </Link>
          <Link
            href="/explore?type=movie&audio=hi"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold shrink-0 transition"
          >
            🇮🇳 Hollywood Hindi Dubbed
          </Link>
          {bollywoodGenres.map((genre) => (
            <Link
              key={genre.id}
              href={`/explore?type=movie&genre=${genre.id}`}
              className="text-xs px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 shrink-0 transition"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Content Rows */}
      <div className="space-y-4">
        <MediaRow
          title="Trending Bollywood Movies"
          subtitle="Desi Cinema"
          items={bollywoodTrending}
          viewAllHref="/explore?type=movie"
          iconName="flame"
        />

        <MediaRow
          title="Popular Hindi Web Series"
          subtitle="Binge Worthy Drama"
          items={bollywoodSeries}
          viewAllHref="/explore?type=tv"
          iconName="tv"
        />

        <MediaRow
          title="Hollywood Blockbusters in Hindi Dub"
          subtitle="Hollywood in Hindi"
          items={hollywoodHindiDubbed}
          viewAllHref="/explore?type=movie&audio=hi"
          iconName="film"
        />

        <MediaRow
          title="All-Time Top Rated Bollywood Hits"
          subtitle="Cinematic Masterpieces"
          items={topRatedBollywood}
          viewAllHref="/explore?type=movie&sort=vote_average.desc"
          iconName="trophy"
        />

        <MediaRow
          title="High Voltage Bollywood Action"
          subtitle="Adrenaline & Stunts"
          items={actionBollywood}
          viewAllHref="/explore?type=movie&genre=28"
          iconName="sparkles"
        />

        <MediaRow
          title="Bollywood Romance & Drama"
          subtitle="Heart Touching Stories"
          items={romanceBollywood}
          viewAllHref="/explore?type=movie&genre=10749"
          iconName="heart"
        />
      </div>
    </div>
  );
}
