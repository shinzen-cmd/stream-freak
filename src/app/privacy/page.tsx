import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
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
            <ShieldCheck className="w-4 h-4" /> Privacy & Data
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Last updated: September 2026. Plain English, no legal fluff.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6 text-gray-300 leading-relaxed text-sm sm:text-base">
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <EyeOff className="w-5 h-5 text-emerald-400" />
              <h2>No Accounts, No Tracking</h2>
            </div>
            <p>
              Stream Freak does not require an account or login to use. We do not collect your name, email address, payment details, or any personally identifiable information.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2>Your Data Stays on Your Device</h2>
            </div>
            <p>
              Your watchlist and continue watching progress are saved strictly inside your browser local storage. This data never touches our servers and never gets uploaded anywhere. If you clear your browser cache, your saved list resets.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h2>Third-Party Streams & Cookies</h2>
            </div>
            <p>
              Stream Freak does not host media files on its servers. Content is resolved dynamically through third-party public streaming providers. Third-party video hosts may use standard web storage or cookies necessary to deliver video segments. We do not inject advertising cookies or sell data to brokers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-lg">Analytics & Logging</h2>
            <p>
              We only inspect minimal server logs (such as request timestamps and status codes) purely to maintain uptime, monitor server health, and prevent abuse.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
