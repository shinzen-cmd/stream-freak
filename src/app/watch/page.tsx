"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Film, ArrowLeft, Loader2 } from "lucide-react";
import { getMediaDetails } from "@/lib/mediaService";
import { MediaDetail, MediaType } from "@/types/media";
import WatchClientView from "@/components/WatchClientView";

function WatchContent() {
  const searchParams = useSearchParams();
  const rawType = (searchParams.get("type") || "movie").toLowerCase() as MediaType;
  const rawId = searchParams.get("id") || "";
  const seasonParam = searchParams.get("s");
  const episodeParam = searchParams.get("e") || searchParams.get("ep");
  const playParam = searchParams.get("play") === "true";

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialSeason = seasonParam ? parseInt(seasonParam, 10) : 1;
  const initialEpisode = episodeParam ? parseInt(episodeParam, 10) : 1;

  useEffect(() => {
    if (!rawId) {
      setLoading(false);
      setError("No media ID provided");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getMediaDetails(rawId, rawType)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setDetail(data);
          setError(null);
        } else {
          setError("Media details not found");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[WatchPage] Error loading details:", err);
        setError(err.message || "Failed to load media details");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [rawType, rawId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" suppressHydrationWarning>
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
        <p className="text-sm text-gray-300 font-medium">Loading stream & details...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" suppressHydrationWarning>
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Film className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Media Title Not Found</h1>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          We couldn&apos;t find stream data or metadata for this title. It may have been removed or the ID is invalid.
        </p>
        <Link
          href="/explore"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Explore</span>
        </Link>
      </div>
    );
  }

  return (
    <WatchClientView
      key={`${detail.mediaType}-${detail.id}-${initialSeason}-${initialEpisode}`}
      initialData={detail}
      initialSeason={isNaN(initialSeason) ? 1 : initialSeason}
      initialEpisode={isNaN(initialEpisode) ? 1 : initialEpisode}
      autoPlay={playParam}
    />
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
