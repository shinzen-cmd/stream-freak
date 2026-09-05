import React from "react";
import HeroBanner from "@/components/HeroBanner";
import MediaRow from "@/components/MediaRow";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import { getTrendingMovies, getTrendingTV, getPopularMovies, getTopRatedTV, getBollywoodMovies, getHollywoodHindiDubbedMovies } from "@/lib/tmdb";
import { getTrendingAnime, getTopRatedAnime } from "@/lib/anilist";

export default async function HomePage() {
  const [
    trendingMovies,
    trendingTV,
    trendingAnime,
    popularMovies,
    topRatedTV,
    topRatedAnime,
    bollywoodHits,
    hollywoodHindiDubbed,
  ] = await Promise.all([
    getTrendingMovies("day").catch(() => []),
    getTrendingTV("day").catch(() => []),
    getTrendingAnime(1, 20).catch(() => []),
    getPopularMovies(1).catch(() => []),
    getTopRatedTV(1).catch(() => []),
    getTopRatedAnime(1, 20).catch(() => []),
    getBollywoodMovies(1).catch(() => []),
    getHollywoodHindiDubbedMovies(1).catch(() => []),
  ]);

  // Mix top items for the dynamic Hero Carousel
  const heroItems = [
    ...trendingMovies.slice(0, 2),
    ...bollywoodHits.slice(0, 2),
    ...trendingAnime.slice(0, 1),
    ...trendingTV.slice(0, 1),
  ].filter(Boolean);

  return (
    <div className="min-h-screen pb-16">
      {/* Dynamic Hero Billboard Banner */}
      <HeroBanner items={heroItems.length > 0 ? heroItems : trendingMovies} />

      {/* User's Continue Watching Row (Client side storage) */}
      <ContinueWatchingRow />

      {/* Media Rows */}
      <div className="space-y-4">
        <MediaRow
          title="Trending Movies Today"
          subtitle="Blockbuster Hits"
          items={trendingMovies}
          viewAllHref="/movies"
          iconName="flame"
        />

        <MediaRow
          title="Bollywood Hits & Blockbusters"
          subtitle="Desi Cinema"
          items={bollywoodHits}
          viewAllHref="/bollywood"
          iconName="flame"
        />

        <MediaRow
          title="Hollywood Movies in Hindi Dub"
          subtitle="Hollywood in Hindi"
          items={hollywoodHindiDubbed}
          viewAllHref="/explore?type=movie&audio=hi"
          iconName="film"
        />

        <MediaRow
          title="Trending Anime"
          subtitle="Otaku Favorites"
          items={trendingAnime}
          viewAllHref="/anime"
          iconName="sparkles"
        />

        <MediaRow
          title="Binge-Worthy TV Shows"
          subtitle="Top Series"
          items={trendingTV}
          viewAllHref="/tv"
          iconName="tv"
        />

        <MediaRow
          title="Popular Movies"
          subtitle="Fan Loved"
          items={popularMovies}
          viewAllHref="/explore?type=movie&sort=popularity.desc"
          iconName="film"
        />

        <MediaRow
          title="Highest Rated Anime of All Time"
          subtitle="Masterpieces"
          items={topRatedAnime}
          viewAllHref="/explore?type=anime&sort=vote_average.desc"
          iconName="trophy"
        />

        <MediaRow
          title="Critically Acclaimed TV Series"
          subtitle="Must Watch"
          items={topRatedTV}
          viewAllHref="/explore?type=tv&sort=vote_average.desc"
          iconName="star"
        />
      </div>
    </div>
  );
}
