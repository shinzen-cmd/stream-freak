"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Compass, Filter, Sparkles, Film, Tv, SlidersHorizontal, Loader2, ArrowUpDown, Globe } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import { MediaItem, GenreItem, MediaType } from "@/types/media";
import { discoverMovies, discoverTV, getMovieGenres, getTVGenres } from "@/lib/tmdb";
import { discoverAnime, ANIME_GENRES } from "@/lib/anilist";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialType = (searchParams.get("type") as MediaType) || "movie";
  const initialGenre = searchParams.get("genre") || "";
  const initialSort = searchParams.get("sort") || "popularity.desc";
  const initialYear = searchParams.get("year") || "";
  const initialAudio = searchParams.get("audio") || "";

  const [mediaType, setMediaType] = useState<MediaType>(initialType);
  const [genre, setGenre] = useState<string>(initialGenre);
  const [sortBy, setSortBy] = useState<string>(initialSort);
  const [year, setYear] = useState<string>(initialYear);
  const [audio, setAudio] = useState<string>(initialAudio);

  const [genresList, setGenresList] = useState<GenreItem[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Sync state when URL params change
  useEffect(() => {
    const typeParam = (searchParams.get("type") as MediaType) || "movie";
    setMediaType(typeParam);
    setGenre(searchParams.get("genre") || "");
    setSortBy(searchParams.get("sort") || "popularity.desc");
    setYear(searchParams.get("year") || "");
    setAudio(searchParams.get("audio") || "");
    setPage(1);
  }, [searchParams]);

  // Load genres based on mediaType
  useEffect(() => {
    async function loadGenres() {
      if (mediaType === "movie") {
        const list = await getMovieGenres();
        setGenresList(list);
      } else if (mediaType === "tv") {
        const list = await getTVGenres();
        setGenresList(list);
      } else {
        setGenresList(ANIME_GENRES);
      }
    }
    loadGenres();
  }, [mediaType]);

  // Fetch media results
  useEffect(() => {
    let isCancelled = false;
    async function fetchMedia() {
      setLoading(true);
      try {
        if (mediaType === "movie") {
          const res = await discoverMovies({
            genreId: genre || undefined,
            sortBy,
            year: year || undefined,
            withSpokenLanguages: audio === "hi" ? "hi" : undefined,
            withOriginalLanguage: audio === "hi_orig" ? "hi" : undefined,
            page,
          });
          if (!isCancelled) {
            setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
            setTotalPages(res.totalPages);
          }
        } else if (mediaType === "tv") {
          const res = await discoverTV({
            genreId: genre || undefined,
            sortBy,
            year: year || undefined,
            page,
          });
          if (!isCancelled) {
            setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
            setTotalPages(res.totalPages);
          }
        } else {
          // Anime
          const res = await discoverAnime({
            genre: genre || undefined,
            sortBy,
            year: year || undefined,
            page,
            perPage: 20,
          });
          if (!isCancelled) {
            setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
            setTotalPages(res.totalPages);
          }
        }
      } catch (err) {
        console.error("Explore fetch error:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchMedia();
    return () => {
      isCancelled = true;
    };
  }, [mediaType, genre, sortBy, year, audio, page]);

  const handleTypeChange = (newType: MediaType) => {
    setMediaType(newType);
    setGenre("");
    setPage(1);
    router.push(`/explore?type=${newType}&sort=${sortBy}`);
  };

  const handleGenreChange = (newGenre: string) => {
    setGenre(newGenre);
    setPage(1);
    const params = new URLSearchParams();
    params.set("type", mediaType);
    if (newGenre) params.set("genre", newGenre);
    if (sortBy) params.set("sort", sortBy);
    if (year) params.set("year", year);
    router.push(`/explore?${params.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
    const params = new URLSearchParams();
    params.set("type", mediaType);
    if (genre) params.set("genre", genre);
    params.set("sort", newSort);
    if (year) params.set("year", year);
    router.push(`/explore?${params.toString()}`);
  };

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    setPage(1);
    const params = new URLSearchParams();
    params.set("type", mediaType);
    if (genre) params.set("genre", genre);
    if (sortBy) params.set("sort", sortBy);
    if (newYear) params.set("year", newYear);
    if (audio) params.set("audio", audio);
    router.push(`/explore?${params.toString()}`);
  };

  const handleAudioChange = (newAudio: string) => {
    setAudio(newAudio);
    setPage(1);
    const params = new URLSearchParams();
    params.set("type", mediaType);
    if (genre) params.set("genre", genre);
    if (sortBy) params.set("sort", sortBy);
    if (year) params.set("year", year);
    if (newAudio) params.set("audio", newAudio);
    router.push(`/explore?${params.toString()}`);
  };

  const currentYears = [
    { label: "All Years", value: "" },
    { label: "2026", value: "2026" },
    { label: "2025", value: "2025" },
    { label: "2024", value: "2024" },
    { label: "2023", value: "2023" },
    { label: "2022", value: "2022" },
    { label: "2021", value: "2021" },
    { label: "2020", value: "2020" },
    { label: "2010s", value: "2019" },
  ];

  return (
    <div className="max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 pt-20 xs:pt-24 sm:pt-28 pb-16">
      {/* Page Title Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
            <Compass className="w-4 h-4" /> Discovery Hub
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            Explore <span className="gradient-text">Catalog</span>
          </h1>
        </div>

        {/* Media Type Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          <button
            onClick={() => handleTypeChange("movie")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              mediaType === "movie"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Film className="w-4 h-4" /> Movies
          </button>
          <button
            onClick={() => handleTypeChange("tv")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              mediaType === "tv"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Tv className="w-4 h-4" /> TV Shows
          </button>
          <button
            onClick={() => handleTypeChange("anime")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              mediaType === "anime"
                ? "bg-purple-500 text-black shadow-md shadow-purple-500/20"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Anime
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Genre Selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1 block flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Genre:
          </label>
          <select
            value={genre}
            onChange={(e) => handleGenreChange(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All Genres</option>
            {genresList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Audio / Language Selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1 block flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-emerald-400" /> Audio Track:
          </label>
          <select
            value={audio}
            onChange={(e) => handleAudioChange(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Audio Tracks</option>
            <option value="hi">🇮🇳 Hindi Dubbed / Spoken</option>
            <option value="hi_orig">🇮🇳 Hindi Original (Bollywood)</option>
          </select>
        </div>

        {/* Sort By Selector */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1 block flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" /> Sort By:
          </label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="popularity.desc">Most Popular</option>
            <option value="vote_average.desc">Highest Rating</option>
            <option value="release_date.desc">Newest Releases</option>
          </select>
        </div>

        {/* Release Year */}
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1 block flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" /> Release Year:
          </label>
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {currentYears.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {loading && page === 1 ? (
        <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-2.5 xs:gap-3.5 sm:gap-4 lg:gap-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center glass-panel rounded-2xl border border-white/10 p-8">
          <Filter className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No titles match your filters</h3>
          <p className="text-sm text-gray-400 mb-4">Try clearing some filter criteria to discover more media.</p>
          <button
            onClick={() => {
              setGenre("");
              setYear("");
              setSortBy("popularity.desc");
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-xs"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-2.5 xs:gap-3.5 sm:gap-4 lg:gap-6">
            {items.map((item, idx) => (
              <MediaCard key={`${item.mediaType}-${item.id}-${idx}`} item={item} />
            ))}
          </div>

          {/* Load More Button */}
          {page < totalPages && (
            <div className="mt-12 text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/10 hover:border-cyan-500/50 transition-all inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Titles</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
