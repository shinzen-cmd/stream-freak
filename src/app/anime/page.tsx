import React from "react";
import HeroBanner from "@/components/HeroBanner";
import MediaRow from "@/components/MediaRow";
import Link from "next/link";
import { getTrendingAnime, getPopularAnime, getTopRatedAnime, discoverAnime, ANIME_GENRES } from "@/lib/anilist";
import { Sparkles } from "lucide-react";

export default async function AnimePage() {
  const [
    trending,
    popular,
    topRated,
    actionAnime,
    fantasyAnime,
  ] = await Promise.all([
    getTrendingAnime(1, 20).catch(() => []),
    getPopularAnime(1, 20).catch(() => []),
    getTopRatedAnime(1, 20).catch(() => []),
    discoverAnime({ genre: "Action", perPage: 20 }).then((d) => d.items).catch(() => []),
    discoverAnime({ genre: "Fantasy", perPage: 20 }).then((d) => d.items).catch(() => []),
  ]);

  return (
    <div className="min-h-screen pb-16">
      {/* Featured Banner */}
      <HeroBanner items={trending.length > 0 ? trending : popular} />

      {/* Genre Pills */}
      <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 -mt-4 xs:-mt-6 relative z-30 mb-6 xs:mb-8">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar border border-white/10">
          <span className="text-xs uppercase font-bold text-emerald-400 shrink-0 mr-2">
            Anime Genres:
          </span>
          <Link
            href="/explore?type=anime"
            className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-semibold shrink-0 shadow-sm"
          >
            All Anime
          </Link>
          {ANIME_GENRES.map((genre) => (
            <Link
              key={genre.id}
              href={`/explore?type=anime&genre=${genre.id}`}
              className="text-xs px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 shrink-0 transition"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Anime Rows */}
      <div className="space-y-4">
        <MediaRow
          title="Trending Anime"
          subtitle="Currently Hyped"
          items={trending}
          viewAllHref="/explore?type=anime&sort=trending"
          iconName="flame"
        />

        <MediaRow
          title="Most Popular Anime of All Time"
          subtitle="Iconic Series"
          items={popular}
          viewAllHref="/explore?type=anime&sort=popularity.desc"
          iconName="sparkles"
        />

        <MediaRow
          title="Top Rated Masterpieces"
          subtitle="Critically Acclaimed"
          items={topRated}
          viewAllHref="/explore?type=anime&sort=vote_average.desc"
          iconName="trophy"
        />

        <MediaRow
          title="Action & Shonen Epics"
          subtitle="High Octane Battles"
          items={actionAnime}
          viewAllHref="/explore?type=anime&genre=Action"
          iconName="sparkles"
        />

        <MediaRow
          title="Fantasy & Isekai Adventures"
          subtitle="Magical Realms"
          items={fantasyAnime}
          viewAllHref="/explore?type=anime&genre=Fantasy"
          iconName="heart"
        />
      </div>
    </div>
  );
}
