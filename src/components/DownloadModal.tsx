"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Download,
  X,
  Copy,
  Check,
  Film,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  FileVideo,
} from "lucide-react";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  mediaType: "movie" | "tv" | "anime";
  season?: number;
  episode?: number;
  episodeTitle?: string;
  selectedLang?: string;
  directStreamUrl?: string | null;
  rawStreamUrl?: string | null;
  onTriggerDirectDownload?: () => void;
}

export default function DownloadModal({
  isOpen,
  onClose,
  title,
  posterPath,
  backdropPath,
  mediaType,
  season = 1,
  episode = 1,
  episodeTitle,
  selectedLang = "en",
  directStreamUrl,
  rawStreamUrl,
  onTriggerDirectDownload,
}: DownloadModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const displayEpisode =
    mediaType === "movie"
      ? "Feature Film"
      : `Season ${season} · Episode ${episode}${episodeTitle ? ` — "${episodeTitle}"` : ""}`;

  const langLabel =
    selectedLang === "hi"
      ? "Hindi Dub"
      : selectedLang === "es"
      ? "Spanish Dub"
      : selectedLang === "fr"
      ? "French Dub"
      : selectedLang === "ta"
      ? "Tamil Dub"
      : "Original (English)";

  const effectiveStreamLink = rawStreamUrl || directStreamUrl || "";

  const handleCopyLink = () => {
    if (!effectiveStreamLink) return;
    navigator.clipboard.writeText(effectiveStreamLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleStartDownload = () => {
    setDownloading(true);
    if (onTriggerDirectDownload) {
      onTriggerDirectDownload();
    }
    setTimeout(() => setDownloading(false), 2000);
  };

  const poster = backdropPath || posterPath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl rounded-2xl xs:rounded-3xl bg-[#0d111d] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Preview Banner */}
        <div className="relative h-36 xs:h-44 sm:h-48 w-full overflow-hidden shrink-0">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              className="object-cover opacity-30 blur-sm scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-950/40 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d111d] via-[#0d111d]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-sm z-10"
            aria-label="Close download hub"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title and metadata in header */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3.5">
            {posterPath && (
              <div className="relative w-16 h-24 xs:w-20 xs:h-28 rounded-xl overflow-hidden shadow-xl border border-white/10 shrink-0 hidden xs:block">
                <Image src={posterPath} alt={title} fill className="object-cover" />
              </div>
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                  1080p Full HD
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-[10px] font-medium">
                  {langLabel}
                </span>
              </div>
              <h3 className="text-base xs:text-lg sm:text-xl font-bold text-white truncate drop-shadow-md">
                {title}
              </h3>
              <p className="text-xs text-white/50 line-clamp-1">{displayEpisode}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 xs:p-6 space-y-4 overflow-y-auto">
          {/* Direct Stream Option */}
          <div className="p-4 rounded-xl xs:rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/40 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Direct Stream Download</h4>
                  <p className="text-xs text-white/50">1080p Ultra High Bitrate · MP4/HLS</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                Fastest
              </span>
            </div>

            <button
              onClick={handleStartDownload}
              disabled={downloading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold text-xs xs:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
            >
              {downloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Preparing Download…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Media File (Direct)
                </>
              )}
            </button>
          </div>

          {/* Copyable Stream URL for External Downloaders (IDM, 1DM, VLC, MX Player) */}
          <div className="p-4 rounded-xl xs:rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <FileVideo className="w-4 h-4 text-cyan-400" />
                <span>External Downloaders (IDM, 1DM, VLC)</span>
              </div>
              <span className="text-[10px] text-white/40">Multi-Threaded</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Use this direct stream link inside Internet Download Manager, 1DM (Mobile), or VLC Player for maximum download speed with pause & resume.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={
                  effectiveStreamLink
                    ? effectiveStreamLink
                    : `https://streamfreak.pro/api/stream/direct/${mediaType}/${season}/${episode}`
                }
                className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-white/70 font-mono select-all truncate outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Security & Ad-Free Promise */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <p className="text-[11px] leading-tight">
              Ad-Free Hub: Downloads are delivered cleanly without popups or third-party ad redirects.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 xs:p-4 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
          <span>Stream Freak Edge CDN</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
