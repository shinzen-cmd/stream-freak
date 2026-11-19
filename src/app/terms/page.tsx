import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft, Globe, ShieldAlert, Cpu, UserCheck, Bell, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-24 min-h-screen">
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
            <FileText className="w-4 h-4" /> Terms & Conditions
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Last updated: November 2026. Clear, straightforward terms for using Stream Freak across Web, PC, Android, and Android TV.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-7 text-gray-300 leading-relaxed text-sm sm:text-base">
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>1. Agreement & Supported Platforms</h2>
            </div>
            <p>
              By accessing or installing Stream Freak on Web, PC/Desktop (PWA), Android Mobile, or Android TV, you agree to these Terms of Service. Stream Freak is a discovery catalog and media interface for browsing movies, television series, Bollywood, and anime.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>2. Accounts, Guest Access & TV Mode</h2>
            </div>
            <p>
              Browsing and primary playback are available without an account. Creating a free account (via email/password or Google Sign-In) unlocks cloud-synced Watchlists, Watch History, Downloads, Auto-Skip controls, and Backup Servers on Web, PC, and Mobile. Dedicated Android TV installations may run locally without sign-in. You are responsible for keeping your account credentials secure.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>3. Third-Party Streams, Downloaders & Metadata</h2>
            </div>
            <p>
              Stream Freak does not host, upload, or store any video or media files on its own servers. All embedded streams, audio tracks, and external download pages are provided by independent third-party services, and catalog metadata (posters, titles, episode guides) is sourced from public APIs such as TMDB and AniList. We do not control the uptime, availability, or content of third-party providers.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Users className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>4. Watch Parties & Interactive Features</h2>
            </div>
            <p>
              Co-watching rooms and shared viewing sessions are provided for private, personal viewing with friends and family. Sessions may be subject to idle timeouts, participant limits, or rate limits to protect service stability. Harassment, illegal broadcasts, or automated abuse in shared rooms will result in immediate account termination.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Bell className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>5. Announcements & Notifications</h2>
            </div>
            <p>
              Stream Freak may display in-app announcements regarding updates, maintenance, or new features, and may send optional Android push notifications if you grant notification permission on your device. You can disable push notifications at any time in your Android system settings.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>6. Acceptable Use & Service Changes</h2>
            </div>
            <p>
              Stream Freak is provided &ldquo;as is&rdquo; for personal, non-commercial use. You agree not to reverse-engineer, scrape, overload, or attempt unauthorized access to Stream Freak infrastructure or user accounts. We reserve the right to update features, mirror sources, or these terms at any time.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
