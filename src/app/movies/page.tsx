import React from "react";
import HeroBanner from "@/components/HeroBanner";
import MediaRow from "@/components/MediaRow";
import Link from "next/link";
import { getTrendingMovies, getPopularMovies, getTopRatedMovies, getUpcomingMovies, discoverMovies, getMovieGenres, getHollywoodHindiDubbedMovies } from "@/lib/tmdb";
import { Film } from "lucide-react";

export default async function MoviesPage() {
  const [
    trending,
    popular,
    topRated,
    upcoming,
    hollywoodHindiDubbed,
    actionMovies,
    sciFiMovies,
    genres,
  ] = await Promise.all([
    getTrendingMovies("week").catch(() => []),
    getPopularMovies(1).catch(() => []),
    getTopRatedMovies(1).catch(() => []),
    getUpcomingMovies(1).catch(() => []),
    getHollywoodHindiDubbedMovies(1).catch(() => []),
    discoverMovies({ genreId: 28 }).then((d) => d.items).catch(() => []), // 28: Action
    discoverMovies({ genreId: 878 }).then((d) => d.items).catch(() => []), // 878: Sci-Fi
    getMovieGenres().catch(() => []),
  ]);

  return (
    <div className="min-h-screen pb-16">
      {/* Featured Banner */}
      <HeroBanner items={trending.length > 0 ? trending : popular} />

      {/* Genre Pills */}
      <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 -mt-4 xs:-mt-6 relative z-30 mb-6 xs:mb-8">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar border border-white/10">
          <span className="text-xs uppercase font-bold text-emerald-400 shrink-0 mr-2">
            Movie Genres:
          </span>
          <Link
            href="/explore?type=movie"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-semibold shrink-0 shadow-sm"
          >
            All Movies
          </Link>
          <Link
            href="/explore?type=movie&audio=hi"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold shrink-0 transition"
          >
            🇮🇳 Hindi Dubbed Hollywood
          </Link>
          <Link
            href="/bollywood"
            className="text-xs px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 shrink-0 transition"
          >
            Bollywood Movies
          </Link>
          {genres.slice(0, 12).map((genre) => (
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

      {/* Movie Content Rows */}
      <div className="space-y-4">
        <MediaRow
          title="Trending Movies This Week"
          subtitle="Hot Right Now"
          items={trending}
          viewAllHref="/explore?type=movie&sort=popularity.desc"
          iconName="flame"
        />

        <MediaRow
          title="Hollywood Movies in Hindi Dub"
          subtitle="Hindi Audio Track"
          items={hollywoodHindiDubbed}
          viewAllHref="/explore?type=movie&audio=hi"
          iconName="film"
        />

        <MediaRow
          title="Popular Blockbusters"
          subtitle="Fan Favorites"
          items={popular}
          viewAllHref="/explore?type=movie&sort=popularity.desc"
          iconName="film"
        />

        <MediaRow
          title="Top Rated Movies of All Time"
          subtitle="Cinema Classics"
          items={topRated}
          viewAllHref="/explore?type=movie&sort=vote_average.desc"
          iconName="star"
        />

        <MediaRow
          title="Action & Adrenaline"
          subtitle="Explosive Thrills"
          items={actionMovies}
          viewAllHref="/explore?type=movie&genre=28"
          iconName="sparkles"
        />

        <MediaRow
          title="Sci-Fi & Futuristic Worlds"
          subtitle="Mind Bending"
          items={sciFiMovies}
          viewAllHref="/explore?type=movie&genre=878"
          iconName="sparkles"
        />

        <MediaRow
          title="Upcoming In Theaters & Streaming"
          subtitle="Coming Soon"
          items={upcoming}
          viewAllHref="/explore?type=movie&sort=release_date.desc"
          iconName="calendar"
        />
      </div>
    </div>
  );
}
