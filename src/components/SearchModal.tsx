"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Search, X, Film, Tv, Sparkles, Star, Loader2 } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";
import { MediaItem } from "@/types/media";
import { executeSmartSearch } from "@/lib/fuzzySearch";
import MediaDetailModal from "@/components/MediaDetailModal";

export default function SearchModal() {
  const { isSearchOpen, closeSearch } = useWatchlist();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "movie" | "tv" | "anime">("all");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSuggestion(null);
      setSelectedItem(null);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSuggestion(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { results: smartResults, suggestion: smartSuggestion } = await executeSmartSearch(query);
        setResults(smartResults);
        setSuggestion(smartSuggestion);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isSearchOpen) return null;

  const filteredResults = results.filter((item) => {
    if (activeTab === "all") return true;
    return item.mediaType === activeTab;
  });

  const applySuggestion = (sug: string) => {
    setQuery(sug);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[max(3.5rem,env(safe-area-inset-top,1rem))] sm:pt-24 px-3 xs:px-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        {/* Click outside backdrop */}
        <div className="fixed inset-0" onClick={closeSearch} />

        <div className="relative w-full max-w-3xl 2xl:max-w-4xl 3xl:max-w-5xl glass-panel rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-10 flex flex-col max-h-[85vh] 3xl:max-h-[75vh]">
          {/* Search Input Header */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="flex items-center px-3.5 xs:px-4 py-3 xs:py-3.5 border-b border-white/10 gap-2 xs:gap-3"
          >
            <Search className="w-5 h-5 text-emerald-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, anime, TV shows (e.g. 'Inception', 'Attack on Titan')..."
              className="w-full bg-transparent text-white placeholder-gray-400 text-base focus:outline-none"
            />
            {loading && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-gray-400 hover:text-white p-1 transition"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeSearch}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border-b border-white/5 overflow-x-auto no-scrollbar">
          {(["all", "movie", "tv", "anime"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-1.5 rounded-full capitalize font-medium transition ${
                activeTab === tab
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-bold"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab === "all" ? "All Content" : tab === "movie" ? "Movies" : tab === "tv" ? "TV Shows" : "Anime"}
            </button>
          ))}
        </div>

          {/* Typo Suggestion Banner */}
          {suggestion && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Did you mean:</span>
              <button
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className="font-bold underline text-emerald-300 hover:text-emerald-100 transition"
              >
                {suggestion}
              </button>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {query.trim() === "" ? (
              <div className="py-10 px-4 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Search Movies, TV Shows, and Anime</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Type a title, actor, or genre above, or tap a trending search below to explore.
                  </p>
                </div>
                <div className="w-full max-w-md pt-2">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                    Popular Searches
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "Inception",
                      "Attack on Titan",
                      "Breaking Bad",
                      "Interstellar",
                      "Demon Slayer",
                      "Stranger Things",
                      "Spirited Away",
                      "Oppenheimer",
                    ].map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/30 border border-white/5 text-xs text-gray-300 hover:text-emerald-300 transition"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : filteredResults.length === 0 && !loading ? (
              <div className="py-10 px-4 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                  <Search className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    No results found for &ldquo;{query}&rdquo;
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    We couldn&apos;t find any matches. Try checking your spelling or search with fewer words.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-md pt-2">
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-sm"
                  >
                    Clear Search
                  </button>
                  {[
                    "Trending Movies",
                    "Top Anime",
                    "Popular Shows",
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (cat === "Top Anime") {
                          setActiveTab("anime");
                          setQuery("Anime");
                        } else if (cat === "Popular Shows") {
                          setActiveTab("tv");
                          setQuery("Show");
                        } else {
                          setActiveTab("movie");
                          setQuery("Movie");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              filteredResults.map((item) => (
                <button
                  key={`${item.mediaType}-${item.id}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="w-full text-left flex items-center gap-4 p-2.5 rounded-xl hover:bg-white/10 transition group border border-transparent hover:border-white/10"
                >
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                    {item.posterPath ? (
                      <Image
                        src={item.posterPath}
                        alt={item.title}
                        fill
                        sizes="48px"
                        className="object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-gray-500">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.mediaType === "movie"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : item.mediaType === "tv"
                            ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {item.mediaType}
                      </span>
                      {item.releaseDate && (
                        <span className="text-xs text-gray-400">{item.releaseDate.slice(0, 4)}</span>
                      )}
                      {item.voteAverage > 0 && (
                        <div className="flex items-center gap-1 text-xs text-amber-400 ml-auto">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{item.voteAverage}</span>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{item.overview}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Netflix / Crunchyroll / MovieBazar Style Detail Modal */}
      <MediaDetailModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onPlay={() => {
          setSelectedItem(null);
          closeSearch();
        }}
      />
    </>
  );
}
