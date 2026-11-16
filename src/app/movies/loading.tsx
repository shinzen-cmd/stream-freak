import React from "react";
import { HeroBannerSkeleton, MediaRowSkeleton } from "@/components/skeletons/Skeletons";

export default function MoviesLoading() {
  return (
    <div className="min-h-screen pb-16">
      <HeroBannerSkeleton />

      {/* Genre Pills Skeleton */}
      <div className="max-w-7xl 2xl:max-w-[1536px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 -mt-4 xs:-mt-6 relative z-30 mb-6">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2.5 overflow-hidden border border-white/10">
          <div className="h-4 w-24 rounded skeleton shrink-0" />
          <div className="h-7 w-24 rounded-full skeleton shrink-0" />
          <div className="h-7 w-36 rounded-full skeleton shrink-0" />
          <div className="h-7 w-28 rounded-full skeleton shrink-0" />
          <div className="h-7 w-20 rounded-full skeleton shrink-0" />
        </div>
      </div>

      <div className="space-y-4">
        <MediaRowSkeleton titleWidth="w-56" />
        <MediaRowSkeleton titleWidth="w-64" />
        <MediaRowSkeleton titleWidth="w-48" />
      </div>
    </div>
  );
}
