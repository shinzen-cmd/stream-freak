import React from "react";
import { MediaGridSkeleton } from "@/components/skeletons/Skeletons";

export default function ExploreLoading() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-3 xs:px-4 sm:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1536px] mx-auto">
      {/* Explore Header Skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-8 w-40 rounded-xl skeleton" />
        <div className="h-4 w-64 rounded skeleton" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="glass-panel rounded-2xl p-4 mb-8 border border-white/10 flex flex-wrap items-center gap-3">
        <div className="h-9 w-32 rounded-xl skeleton" />
        <div className="h-9 w-36 rounded-xl skeleton" />
        <div className="h-9 w-28 rounded-xl skeleton" />
        <div className="h-9 w-32 rounded-xl skeleton" />
      </div>

      {/* Content Grid Skeleton */}
      <MediaGridSkeleton count={14} />
    </div>
  );
}
