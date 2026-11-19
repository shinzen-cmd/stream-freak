import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, Database, UserCircle2, Bell, Trash2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
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
            <ShieldCheck className="w-4 h-4" /> Privacy & Data Protection
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Last updated: November 2026. Plain-English overview of what we store, why we store it, and how you control it.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-7 text-gray-300 leading-relaxed text-sm sm:text-base">
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <UserCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>1. Account & Sign-In Data</h2>
            </div>
            <p>
              If you browse as a guest or use Android TV mode, no account is required and we do not collect your email address. If you choose to create an account or sign in with Google, we store your <strong>email address</strong>, your chosen <strong>profile avatar</strong>, and your account role securely via Supabase Auth. When using Google Sign-In, authentication is handled directly through Google OAuth / Android Credential Manager—Stream Freak never sees or stores your Google password.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Database className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>2. Watchlist, History & Local Storage</h2>
            </div>
            <p>
              For <strong>signed-in users</strong>, your Watchlist and Continue Watching history are synced to our Supabase database (protected by Row-Level Security so only you can modify your own data) to keep your library in sync across phone, PC, and web. For <strong>guests and Android TV</strong>, watchlist and playback preferences (such as Auto-Next and Auto-Skip) stay strictly in your device&apos;s local storage.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Bell className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>3. Notifications & Device Tokens</h2>
            </div>
            <p>
              In-app announcements remember which popups you have dismissed using local storage on your device. If you opt in to Android Push Notifications, an anonymous Firebase Cloud Messaging (FCM) device token is stored solely to deliver app updates and release alerts to your phone. You can revoke notification permission anytime in Android settings.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>4. Third-Party Embeds, Downloaders & Watch Parties</h2>
            </div>
            <p>
              Stream Freak embeds video streams and links to external download pages operated by third-party providers (as well as optional co-watching sessions). Those external services may process standard technical data (such as IP address or player cookies) under their own privacy policies. Stream Freak does not sell your personal data or share it with ad-data brokers.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Trash2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2>5. Your Rights & Data Deletion</h2>
            </div>
            <p>
              You can sign out at any time from your profile menu, clear local app data from your browser or Android settings, or contact the Stream Freak administrator at{" "}
              <span className="text-emerald-400 font-medium">admin@streamfreak.app</span>{" "}
              to request permanent deletion of your account and synced watchlist/history data.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
