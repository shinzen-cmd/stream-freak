"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Play, Layers, Clock, Star, Tv, ChevronDown } from "lucide-react";
import { EpisodeItem, MediaType, SeasonItem } from "@/types/media";
import { getTVSeasonEpisodes } from "@/lib/tmdb";

interface EpisodeSelectorProps {
  mediaType: MediaType;
  tmdbId?: number;
  seasons?: SeasonItem[];
  totalEpisodes?: number;
  currentSeason: number;
  currentEpisode: number;
  onSelectEpisode: (season: number, episode: number, episodeTitle?: string) => void;
}

export default function EpisodeSelector({
  mediaType,
  tmdbId,
  seasons = [],
  totalEpisodes = 12,
  currentSeason,
  currentEpisode,
  onSelectEpisode,
}: EpisodeSelectorProps) {
  const [selectedSeason, setSelectedSeason] = useState(currentSeason || 1);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [animeBatch, setAnimeBatch] = useState(0);

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

  // Anime Episode Grid Generator
  if (mediaType === "anime") {
    const total = totalEpisodes || 12;
    const batchSize = 50;
    const batchCount = Math.ceil(total / batchSize);
    const startIdx = animeBatch * batchSize + 1;
    const endIdx = Math.min(total, (animeBatch + 1) * batchSize);

    const episodeNumbers: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      episodeNumbers.push(i);
    }

    return (
      <div className="space-y-4 p-5 rounded-2xl glass-panel border border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Episodes ({total})</h3>
          </div>

          {/* Episode Batch Selector if > 50 eps */}
          {batchCount > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {Array.from({ length: batchCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setAnimeBatch(i)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition ${
                    animeBatch === i
                      ? "bg-cyan-500 text-black border-cyan-500"
                      : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {i * batchSize + 1} - {Math.min(total, (i + 1) * batchSize)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Anime Episode Grid Buttons */}
        <div className="grid grid-cols-3 min-[360px]:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 2xl:grid-cols-14 3xl:grid-cols-18 4xl:grid-cols-24 gap-1.5 xs:gap-2 max-h-[360px] 3xl:max-h-[500px] overflow-y-auto no-scrollbar pr-1">
          {episodeNumbers.map((epNum) => {
            const isCurrent = currentEpisode === epNum;
            return (
              <button
                key={epNum}
                onClick={() => onSelectEpisode(1, epNum, `Episode ${epNum}`)}
                className={`flex flex-col items-center justify-center p-2 xs:p-3 rounded-lg xs:rounded-xl border text-xs xs:text-sm font-bold transition-all duration-200 ${
                  isCurrent
                    ? "bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/30 scale-105"
                    : "bg-white/5 text-gray-200 border-white/10 hover:bg-white/15 hover:border-cyan-500/50 hover:text-cyan-300"
                }`}
              >
                <span>EP {epNum}</span>
                <span className="text-[9px] xs:text-[10px] font-normal opacity-75">HD</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // TV Shows Season & Episode List
  return (
    <div className="space-y-4 p-3.5 xs:p-5 rounded-xl xs:rounded-2xl glass-panel border border-white/10">
      {/* Header & Season Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 xs:gap-4 border-b border-white/10 pb-3 xs:pb-4">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base xs:text-lg font-bold text-white">Episodes &amp; Seasons</h3>
        </div>

        {/* Season Dropdown */}
        {seasons && seasons.length > 0 && (
          <div className="relative">
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="appearance-none bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs xs:text-sm font-semibold rounded-lg xs:rounded-xl px-3 xs:px-4 py-1.5 xs:py-2 pr-9 xs:pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.seasonNumber} className="bg-gray-900 text-white">
                  {s.name || `Season ${s.seasonNumber}`} ({s.episodeCount} Eps)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Episode Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading season episodes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-2.5 xs:gap-3 max-h-[480px] 3xl:max-h-[640px] overflow-y-auto no-scrollbar pr-1">
          {episodes.map((ep) => {
            const isCurrent = currentSeason === ep.seasonNumber && currentEpisode === ep.episodeNumber;
            return (
              <div
                key={ep.id}
                onClick={() => onSelectEpisode(selectedSeason, ep.episodeNumber, ep.name)}
                className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
                  isCurrent
                    ? "bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-28 h-18 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                  {ep.stillPath ? (
                    <Image
                      src={ep.stillPath}
                      alt={ep.name}
                      fill
                      sizes="112px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                      Ep {ep.episodeNumber}
                    </div>
                  )}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                      isCurrent ? "bg-cyan-500/40 opacity-100" : "bg-black/40 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-cyan-400">
                      E{ep.episodeNumber}
                    </span>
                    {ep.runtime && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {ep.runtime}m
                      </span>
                    )}
                    {ep.voteAverage !== undefined && ep.voteAverage > 0 && (
                      <span className="text-[11px] font-semibold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-auto">
                        ★ {ep.voteAverage}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition">
                    {ep.name}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{ep.overview}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
