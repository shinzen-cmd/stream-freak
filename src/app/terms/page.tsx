import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft, Globe, ShieldAlert, Cpu } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 min-h-screen">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-emerald-400 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </Link>

      <div className="space-y-8">
        <div>
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5 mb-2">
            <FileText className="w-4 h-4" /> Simple Agreement
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Last updated: September 2026. Honest, simple terms for using Stream Freak.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6 text-gray-300 leading-relaxed text-sm sm:text-base">
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Globe className="w-5 h-5 text-emerald-400" />
              <h2>1. Agreement & Purpose</h2>
            </div>
            <p>
              By accessing or using Stream Freak, you agree to these simple terms. Stream Freak provides a web interface and catalog organizer for discovering movies, television series, and anime.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h2>2. Third-Party Content & Indexing</h2>
            </div>
            <p>
              Stream Freak does not host, store, or upload media files on its servers. All video streams and embed players are hosted and distributed by independent third-party sources. We do not claim ownership of any third-party media or copyrighted assets indexed through public APIs (such as TMDB and AniList).
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              <h2>3. Acceptable Use</h2>
            </div>
            <p>
              Stream Freak is intended for personal, non-commercial use. You agree not to perform automated scraping attacks, denial-of-service attempts, or disrupt server infrastructure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-lg">4. Availability & Changes</h2>
            <p>
              We continually work to ensure high performance and reliable uptime. Features, server routes, and indexing methods may change at any time without notice to maintain quality and security.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
