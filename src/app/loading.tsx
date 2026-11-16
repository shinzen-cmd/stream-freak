import React from "react";
import { HeroBannerSkeleton, MediaRowSkeleton } from "@/components/skeletons/Skeletons";

export default function Loading() {
  return (
    <div className="min-h-screen pb-16">
      {/* Hero Banner Skeleton */}
      <HeroBannerSkeleton />

      {/* Media Rows Skeletons */}
      <div className="space-y-4 -mt-4 relative z-20">
        <MediaRowSkeleton titleWidth="w-64" />
        <MediaRowSkeleton titleWidth="w-56" />
        <MediaRowSkeleton titleWidth="w-72" />
        <MediaRowSkeleton titleWidth="w-52" />
      </div>
    </div>
  );
}
