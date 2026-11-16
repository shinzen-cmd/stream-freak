"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Film, ArrowLeft, Loader2 } from "lucide-react";
import { getMediaDetails } from "@/lib/mediaService";
import { MediaDetail, MediaType } from "@/types/media";
import WatchClientView from "@/components/WatchClientView";
import LottieErrorAnimation from "@/components/animations/LottieErrorAnimation";

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

    document.title = "Watch | Stream Freak";

    getMediaDetails(rawId, rawType)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setDetail(data);
          if (data.title) {
            document.title = `${data.title} | Stream Freak`;
          }
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
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center" suppressHydrationWarning>
        <LottieErrorAnimation className="w-56 h-56 sm:w-72 sm:h-72 mb-2" />
        <div className="max-w-md space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            Stream Error
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Media Stream Not Found</h1>
          <p className="text-sm text-gray-400">
            We couldn&apos;t find stream data or metadata for this title. It may have moved or the stream is temporarily unavailable.
          </p>
        </div>
        <Link
          href="/explore"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 transition mt-6"
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
