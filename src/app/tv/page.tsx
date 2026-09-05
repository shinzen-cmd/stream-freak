import React from "react";
import HeroBanner from "@/components/HeroBanner";
import MediaRow from "@/components/MediaRow";
import Link from "next/link";
import { getTrendingTV, getPopularTV, getTopRatedTV, getOnTheAirTV, discoverTV, getTVGenres } from "@/lib/tmdb";
import { Tv } from "lucide-react";

export default async function TVShowsPage() {
  const [
    trending,
    popular,
    topRated,
    onTheAir,
    dramaSeries,
    sciFiSeries,
    genres,
  ] = await Promise.all([
    getTrendingTV("week").catch(() => []),
    getPopularTV(1).catch(() => []),
    getTopRatedTV(1).catch(() => []),
    getOnTheAirTV(1).catch(() => []),
    discoverTV({ genreId: 18 }).then((d) => d.items).catch(() => []), // 18: Drama
    discoverTV({ genreId: 10765 }).then((d) => d.items).catch(() => []), // 10765: Sci-Fi & Fantasy
    getTVGenres().catch(() => []),
  ]);

  return (
    <div className="min-h-screen pb-16">
      {/* Featured Banner */}
      <HeroBanner items={trending.length > 0 ? trending : popular} />

      {/* Genre Pills */}
      <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 -mt-4 xs:-mt-6 relative z-30 mb-6 xs:mb-8">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar border border-white/10">
          <span className="text-xs uppercase font-bold text-emerald-400 shrink-0 mr-2">
            TV Genres:
          </span>
          <Link
            href="/explore?type=tv"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-semibold shrink-0 shadow-sm"
          >
            All Series
          </Link>
          {genres.slice(0, 12).map((genre) => (
            <Link
              key={genre.id}
              href={`/explore?type=tv&genre=${genre.id}`}
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
          title="Trending TV Shows This Week"
          subtitle="Viral Hits"
          items={trending}
          viewAllHref="/explore?type=tv&sort=popularity.desc"
          iconName="flame"
        />

        <MediaRow
          title="Currently Airing Episodes"
          subtitle="On The Air"
          items={onTheAir}
          viewAllHref="/explore?type=tv&sort=popularity.desc"
          iconName="radio"
        />

        <MediaRow
          title="Most Popular Series"
          subtitle="Binge Worthy"
          items={popular}
          viewAllHref="/explore?type=tv&sort=popularity.desc"
          iconName="tv"
        />

        <MediaRow
          title="Top Rated TV of All Time"
          subtitle="Legendary Shows"
          items={topRated}
          viewAllHref="/explore?type=tv&sort=vote_average.desc"
          iconName="star"
        />

        <MediaRow
          title="Sci-Fi & Fantasy TV"
          subtitle="Epic Worlds"
          items={sciFiSeries}
          viewAllHref="/explore?type=tv&genre=10765"
          iconName="sparkles"
        />

        <MediaRow
          title="Gripping Drama Series"
          subtitle="Intense Storylines"
          items={dramaSeries}
          viewAllHref="/explore?type=tv&genre=18"
          iconName="sparkles"
        />
      </div>
    </div>
  );
}
