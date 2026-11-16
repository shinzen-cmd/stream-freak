import React from "react";
import { HeroBannerSkeleton, MediaRowSkeleton } from "@/components/skeletons/Skeletons";

export default function AnimeLoading() {
  return (
    <div className="min-h-screen pb-16">
      <HeroBannerSkeleton />
      <div className="space-y-4 -mt-4 relative z-20">
        <MediaRowSkeleton titleWidth="w-60" />
        <MediaRowSkeleton titleWidth="w-52" />
        <MediaRowSkeleton titleWidth="w-64" />
      </div>
    </div>
  );
}
