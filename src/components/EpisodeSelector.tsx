"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Play,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  Grid,
  Tv,
  ChevronDown,
} from "lucide-react";
import { EpisodeItem, MediaType, SeasonItem } from "@/types/media";
import { getTVSeasonEpisodes } from "@/lib/tmdb";

interface EpisodeSelectorProps {
  mediaType: MediaType;
  tmdbId?: number;
  seasons?: SeasonItem[];
  totalEpisodes?: number;
  currentSeason: number;
  currentEpisode: number;
  audioMode?: "sub" | "dub";
  onSelectEpisode: (season: number, episode: number, episodeTitle?: string) => void;
}

type ViewMode = "number" | "card" | "grid";

export default function EpisodeSelector({
  mediaType,
  tmdbId,
  seasons = [],
  totalEpisodes = 12,
  currentSeason,
  currentEpisode,
  audioMode = "sub",
  onSelectEpisode,
}: EpisodeSelectorProps) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason || 1);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("number");
  const [searchQuery, setSearchQuery] = useState("");
  const [isReversed, setIsReversed] = useState(false);
  const [batchRange, setBatchRange] = useState<number>(0); // index of 100-ep slice

  // For TV Shows: Fetch season episodes from TMDB
  useEffect(() => {
    if (mediaType === "tv" && tmdbId) {
      let isMounted = true;
      setLoading(true);
      getTVSeasonEpisodes(tmdbId, selectedSeason)
        .then((data) => {
          if (isMounted) {
            setEpisodes(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [mediaType, tmdbId, selectedSeason]);

  // Compute total episodes
  const total = useMemo(() => {
    if (mediaType === "anime") return Math.max(1, totalEpisodes || 12);
    if (episodes.length > 0) return episodes.length;
    const currentSeasonMeta = seasons.find((s) => s.seasonNumber === selectedSeason);
    return currentSeasonMeta?.episodeCount || 12;
  }, [mediaType, totalEpisodes, episodes.length, seasons, selectedSeason]);

  // Batch Ranges for Anime or long TV seasons (1-100, 101-200, etc.)
  const BATCH_SIZE = 100;
  const batchCount = Math.ceil(total / BATCH_SIZE);

  const rawEpisodeList = useMemo(() => {
    if (mediaType === "tv" && episodes.length > 0) {
      return episodes.map((ep) => ({
        episodeNumber: ep.episodeNumber,
        title: ep.name || `Episode ${ep.episodeNumber}`,
        overview: ep.overview || "No episode summary provided.",
        stillPath: ep.stillPath,
        runtime: ep.runtime || 24,
      }));
    }

    // Anime or TV fallback: generate episodes 1..total
    const list = [];
    for (let i = 1; i <= total; i++) {
      list.push({
        episodeNumber: i,
        title: `Episode ${i}`,
        overview: `Episode ${i} of the series. Watch in HD with multiple server options.`,
        stillPath: null,
        runtime: 24,
      });
    }
    return list;
  }, [mediaType, episodes, total]);

  // Filtered and Sliced list based on Range, Search Query, and Sort Order
  const displayedEpisodes = useMemo(() => {
    let list = [...rawEpisodeList];

    // Filter by Batch Range if multiple batches exist and not "all" (-1)
    if (batchCount > 1 && batchRange !== -1) {
      const start = batchRange * BATCH_SIZE + 1;
      const end = Math.min(total, (batchRange + 1) * BATCH_SIZE);
      list = list.filter((ep) => ep.episodeNumber >= start && ep.episodeNumber <= end);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (ep) =>
          ep.title.toLowerCase().includes(q) ||
          String(ep.episodeNumber).includes(q) ||
          `ep ${ep.episodeNumber}`.includes(q)
      );
    }

    // Sort Order: Ascending vs Descending
    if (isReversed) {
      list.reverse();
    }

    return list;
  }, [rawEpisodeList, batchCount, batchRange, total, searchQuery, isReversed]);

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-[22px] bg-[#0c0d12]/90 border border-white/[0.07] backdrop-blur-xl shadow-2xl">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">Episodes</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-extrabold border border-emerald-500/30">
                {total}
              </span>
            </div>
            <p className="text-[10px] text-white/40">Select an episode to stream</p>
          </div>
        </div>

        {/* View Mode Switchers (Aniflix Signature 3-View Toolbar) */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode("number")}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "number"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30 font-bold"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title="Episode Number View (Grid of numbers)"
            aria-label="Number View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "card"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30 font-bold"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title="Episode Card View (Detailed cards with thumbnails)"
            aria-label="Card View"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "grid"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30 font-bold"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title="Episode Thumbnail Grid View"
            aria-label="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── CONTROLS: RANGE FILTER, SEARCH & SORT ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* TV Season Dropdown */}
        {mediaType === "tv" && seasons.length > 0 && (
          <div className="relative">
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="appearance-none bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-semibold rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.seasonNumber} className="bg-zinc-950 text-white">
                  {s.name || `Season ${s.seasonNumber}`} ({s.episodeCount} Eps)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Anime Batch Selector (1-100, 101-200, All) */}
        {batchCount > 1 && (
          <div className="relative">
            <select
              value={batchRange}
              onChange={(e) => setBatchRange(Number(e.target.value))}
              className="appearance-none bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-semibold rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
            >
              <option value={-1} className="bg-zinc-950 text-white">All Episodes</option>
              {Array.from({ length: batchCount }).map((_, i) => (
                <option key={i} value={i} className="bg-zinc-950 text-white">
                  {i * BATCH_SIZE + 1} - {Math.min(total, (i + 1) * BATCH_SIZE)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Search Episode Input */}
        <div className="relative flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ep..."
            className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.08] border border-white/10 text-white text-xs rounded-xl pl-8 pr-2.5 py-1.5 outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/30"
          />
        </div>

        {/* Sort Order (Reverse 1..N vs N..1) */}
        <button
          onClick={() => setIsReversed(!isReversed)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
            isReversed
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border-white/10"
          }`}
          title={isReversed ? "Order: Descending (Newest first)" : "Order: Ascending (1 to N)"}
        >
          <ArrowUpDown className="w-3 h-3" />
          <span className="hidden xs:inline">{isReversed ? "Desc" : "Asc"}</span>
        </button>
      </div>

      {/* ── EPISODE CONTAINER (3 VIEWS) ───────────────────────────────────── */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-white/40">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Loading episode catalog...</span>
        </div>
      ) : displayedEpisodes.length === 0 ? (
        <div className="py-10 text-center text-white/40 text-xs">
          No episodes matched &quot;{searchQuery}&quot;
        </div>
      ) : viewMode === "number" ? (
        /* 1. NUMBER VIEW (Aniflix Grid of Numbers 01, 02, 03...) */
        <div className="grid grid-cols-4 min-[380px]:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 max-h-[460px] overflow-y-auto no-scrollbar pr-1 py-1">
          {displayedEpisodes.map((ep) => {
            const isCurrent = currentEpisode === ep.episodeNumber;
            const paddedNum = ep.episodeNumber < 10 ? `0${ep.episodeNumber}` : `${ep.episodeNumber}`;
            return (
              <button
                key={ep.episodeNumber}
                onClick={() => onSelectEpisode(selectedSeason, ep.episodeNumber, ep.title)}
                className={`relative flex items-center justify-center h-10 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/40 font-extrabold scale-105 ring-2 ring-emerald-400/50"
                    : "bg-white/[0.04] text-white/80 hover:bg-white/[0.1] hover:text-emerald-300 border border-white/[0.05]"
                }`}
                title={`Play Episode ${ep.episodeNumber}`}
              >
                {isCurrent ? (
                  <span className="flex items-center gap-1">
                    <Play className="w-3 h-3 fill-current" />
                    <span>{paddedNum}</span>
                  </span>
                ) : (
                  <span>{paddedNum}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : viewMode === "card" ? (
        /* 2. CARD VIEW (Aniflix 16:9 Widescreen list with synopsis & thumbnail) */
        <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-1 py-1">
          {displayedEpisodes.map((ep) => {
            const isCurrent = currentEpisode === ep.episodeNumber;
            return (
              <div
                key={ep.episodeNumber}
                onClick={() => onSelectEpisode(selectedSeason, ep.episodeNumber, ep.title)}
                className={`flex gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                  isCurrent
                    ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                    : "bg-white/[0.03] hover:bg-white/[0.07] border-white/5"
                }`}
              >
                {/* 16:9 Thumbnail with Overlay Play */}
                <div className="relative w-28 sm:w-32 aspect-video rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                  {ep.stillPath ? (
                    <Image
                      src={ep.stillPath}
                      alt={ep.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-[10px] text-white/40 font-semibold">
                      EP {ep.episodeNumber}
                    </div>
                  )}
                  {/* Play Overlay */}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                    isCurrent ? "bg-black/40 opacity-100" : "bg-black/50 opacity-0 group-hover:opacity-100"
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isCurrent ? "bg-emerald-500 text-black" : "bg-white/90 text-black"
                    }`}>
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                  {/* Episode Runtime Pill */}
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[9px] font-bold text-white">
                    {ep.runtime}m
                  </span>
                </div>

                {/* Episode Details */}
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                      isCurrent ? "bg-emerald-500 text-black" : "bg-white/10 text-white/70"
                    }`}>
                      EP {ep.episodeNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                      {audioMode === "dub" ? "DUB" : "SUB"}
                    </span>
                  </div>
                  <h4 className={`text-xs sm:text-sm font-semibold truncate ${
                    isCurrent ? "text-emerald-300" : "text-white group-hover:text-emerald-300"
                  }`}>
                    {ep.title}
                  </h4>
                  <p className="text-[11px] text-white/40 line-clamp-1 mt-0.5">
                    {ep.overview}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 3. GRID VIEW (Medium 16:9 Thumbnail Grid) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto no-scrollbar pr-1 py-1">
          {displayedEpisodes.map((ep) => {
            const isCurrent = currentEpisode === ep.episodeNumber;
            return (
              <div
                key={ep.episodeNumber}
                onClick={() => onSelectEpisode(selectedSeason, ep.episodeNumber, ep.title)}
                className={`flex flex-col rounded-2xl overflow-hidden border transition-all cursor-pointer group ${
                  isCurrent
                    ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/15"
                    : "bg-white/[0.03] hover:bg-white/[0.07] border-white/5"
                }`}
              >
                <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                  {ep.stillPath ? (
                    <Image
                      src={ep.stillPath}
                      alt={ep.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-xs text-white/40 font-semibold">
                      EP {ep.episodeNumber}
                    </div>
                  )}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                    isCurrent ? "bg-black/40 opacity-100" : "bg-black/50 opacity-0 group-hover:opacity-100"
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCurrent ? "bg-emerald-500 text-black" : "bg-white/90 text-black"
                    }`}>
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-bold text-white">
                    EP {ep.episodeNumber}
                  </span>
                </div>
                <div className="p-2">
                  <h4 className={`text-xs font-semibold truncate ${
                    isCurrent ? "text-emerald-300" : "text-white group-hover:text-emerald-300"
                  }`}>
                    {ep.title}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
