import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import LottieErrorAnimation from "@/components/animations/LottieErrorAnimation";
import { Home, Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
};

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-16">
      {/* Lottie 404 Animation */}
      <LottieErrorAnimation className="w-56 h-56 sm:w-72 sm:h-72 mb-2" />

      <div className="max-w-md space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          Error 404
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Lost in the Stream?
        </h1>
        <p className="text-sm text-gray-400">
          The page or stream you are looking for does not exist, has moved, or is temporarily unavailable.
        </p>
      </div>

      {/* 1-Tap Recovery Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-950/40"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
        <Link
          href="/explore"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-sm font-semibold transition border border-white/10"
        >
          <Compass className="w-4 h-4" />
          Explore Titles
        </Link>
      </div>
    </div>
  );
}
