"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import LottieErrorAnimation from "@/components/animations/LottieErrorAnimation";
import { RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error caught:", error);
  }, [error]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <LottieErrorAnimation className="w-56 h-56 sm:w-72 sm:h-72 mb-2" />

      <div className="max-w-md space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
          Something went wrong
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Stream Connection Interrupted
        </h1>
        <p className="text-sm text-gray-400">
          We encountered an unexpected error while loading this content. You can try recovering the connection below.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-950/40"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-sm font-semibold transition border border-white/10"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
