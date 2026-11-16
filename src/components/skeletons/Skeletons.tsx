import React from "react";

export function HeroBannerSkeleton() {
  return (
    <div className="relative w-full h-[65vh] xs:h-[70vh] sm:h-[75vh] 3xl:h-[80vh] min-h-[460px] xs:min-h-[500px] sm:min-h-[560px] max-h-[750px] 3xl:max-h-[1000px] overflow-hidden bg-[#090a0f]">
      {/* Background Shimmer */}
      <div className="absolute inset-0 skeleton opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/80 to-transparent w-full md:w-3/4" />

      {/* Hero Content Overlay */}
      <div className="relative z-20 max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] mx-auto h-full px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12 flex flex-col justify-center pb-10 sm:pb-12">
        <div className="max-w-xl sm:max-w-2xl space-y-4">
          {/* Badge Pills */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-24 rounded-full skeleton" />
            <div className="h-6 w-20 rounded-full skeleton" />
          </div>

          {/* Title Placeholder */}
          <div className="space-y-2">
            <div className="h-9 sm:h-12 w-4/5 rounded-xl skeleton" />
            <div className="h-9 sm:h-12 w-2/5 rounded-xl skeleton" />
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 rounded skeleton" />
            <div className="h-4 w-16 rounded skeleton" />
            <div className="h-4 w-28 rounded skeleton" />
          </div>

          {/* Overview Description */}
          <div className="space-y-1.5 pt-1">
            <div className="h-4 w-full rounded skeleton" />
            <div className="h-4 w-5/6 rounded skeleton" />
            <div className="h-4 w-3/5 rounded skeleton" />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <div className="h-11 sm:h-12 w-32 sm:w-36 rounded-xl skeleton" />
            <div className="h-11 sm:h-12 w-28 sm:w-32 rounded-xl skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-[#12151f] border border-white/5 overflow-hidden">
      {/* Poster Ratio 2:3 */}
      <div className="relative aspect-[2/3] w-full skeleton">
        <div className="absolute top-2.5 left-2.5 h-4 w-12 rounded skeleton bg-white/10" />
      </div>

      {/* Card Info Details */}
      <div className="p-2.5 xs:p-3 flex flex-col flex-1 justify-between gap-2">
        <div className="space-y-1.5">
          <div className="h-4 w-4/5 rounded skeleton" />
          <div className="h-3 w-1/2 rounded skeleton" />
        </div>
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="h-3 w-14 rounded skeleton" />
          <div className="h-4 w-4 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}

export function MediaRowSkeleton({ titleWidth = "w-48" }: { titleWidth?: string }) {
  return (
    <section className="my-6 xs:my-8 3xl:my-12 max-w-7xl 2xl:max-w-[1536px] 3xl:max-w-[1920px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 3xl:px-12">
      {/* Row Header */}
      <div className="flex items-end justify-between mb-3 xs:mb-4">
        <div className="space-y-1">
          <div className="h-3 w-20 rounded skeleton" />
          <div className={`h-6 sm:h-7 ${titleWidth} rounded skeleton`} />
        </div>
        <div className="h-4 w-20 rounded skeleton" />
      </div>

      {/* Media Items Track */}
      <div className="flex items-stretch gap-2.5 xs:gap-3.5 sm:gap-4 overflow-hidden pb-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="w-[135px] min-[360px]:w-[150px] xs:w-[165px] sm:w-[190px] md:w-[210px] lg:w-[225px] 2xl:w-[250px] shrink-0"
          >
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function MediaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7 gap-3 xs:gap-4">
      {[...Array(count)].map((_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function WatchPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#090a0f] pt-16 sm:pt-20 pb-16 px-3 xs:px-4 sm:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1536px] mx-auto space-y-6">
      {/* Back Button Skeleton */}
      <div className="h-9 w-36 rounded-xl skeleton" />

      {/* Video Player Canvas */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0d101a] border border-white/5 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full skeleton opacity-50" />
      </div>

      {/* Title & Metadata */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-full skeleton" />
          <div className="h-6 w-16 rounded-full skeleton" />
        </div>
        <div className="h-8 w-2/3 rounded-xl skeleton" />
        <div className="h-4 w-full max-w-2xl rounded skeleton" />
        <div className="h-4 w-4/5 max-w-xl rounded skeleton" />
      </div>

      {/* Server & Quality Row */}
      <div className="flex items-center gap-2 pt-2 overflow-hidden">
        <div className="h-9 w-28 rounded-lg skeleton" />
        <div className="h-9 w-24 rounded-lg skeleton" />
        <div className="h-9 w-24 rounded-lg skeleton" />
        <div className="h-9 w-24 rounded-lg skeleton" />
      </div>

      {/* Recommendations Row */}
      <MediaRowSkeleton titleWidth="w-56" />
    </div>
  );
}
