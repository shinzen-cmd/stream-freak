"use client";

import React from "react";
import { X, Bell, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { NotificationTone } from "@/lib/notifications";

interface NotificationPopupCardProps {
  title: string;
  message: string;
  tone: NotificationTone;
  badge?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  dismissible?: boolean;
  onDismiss?: () => void;
  onAction?: () => void;
  isPreview?: boolean;
}

const TONE_STYLES: Record<
  NotificationTone,
  { border: string; iconBg: string; iconColor: string; badge: string; btn: string; Icon: React.ElementType }
> = {
  info: {
    border: "border-sky-500/30",
    iconBg: "bg-sky-500/15 border-sky-500/30",
    iconColor: "text-sky-400",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    btn: "bg-sky-500 hover:bg-sky-400 text-black",
    Icon: Info,
  },
  success: {
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconColor: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    btn: "bg-emerald-500 hover:bg-emerald-400 text-black",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    btn: "bg-amber-500 hover:bg-amber-400 text-black",
    Icon: AlertTriangle,
  },
  urgent: {
    border: "border-rose-500/35",
    iconBg: "bg-rose-500/15 border-rose-500/30",
    iconColor: "text-rose-400",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    btn: "bg-rose-500 hover:bg-rose-400 text-white",
    Icon: Bell,
  },
};

export default function NotificationPopupCard({
  title,
  message,
  tone,
  badge,
  imageUrl,
  ctaLabel,
  ctaUrl,
  dismissible = true,
  onDismiss,
  onAction,
  isPreview = false,
}: NotificationPopupCardProps) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.info;
  const ToneIcon = style.Icon;
  const hasCta = Boolean(ctaLabel?.trim() && ctaUrl?.trim());
  const isExternal = Boolean(ctaUrl && /^https?:\/\//i.test(ctaUrl));

  return (
    <div
      role={isPreview ? undefined : "dialog"}
      aria-modal={isPreview ? undefined : true}
      aria-label={title || "Notification"}
      className={`relative w-full max-w-md rounded-2xl bg-[#0e1017] border ${style.border} shadow-2xl overflow-hidden text-white`}
    >
      {imageUrl?.trim() && (
        <div className="relative w-full h-40 bg-black/50 overflow-hidden">
          <img
            src={imageUrl}
            alt={title || "Announcement banner"}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1017] via-transparent to-transparent" />
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl border ${style.iconBg} flex items-center justify-center shrink-0`}>
              <ToneIcon className={`w-5 h-5 ${style.iconColor}`} />
            </div>
            <div className="min-w-0">
              {badge?.trim() && (
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mb-1 ${style.badge}`}>
                  {badge.trim()}
                </span>
              )}
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                {title || "Notification Title"}
              </h3>
            </div>
          </div>

          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close notification"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="mt-3 text-sm text-white/75 leading-relaxed whitespace-pre-line break-words">
          {message || "Write your message here..."}
        </p>

        {(hasCta || dismissible) && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
            {dismissible && (
              <button
                type="button"
                autoFocus={!isPreview && !hasCta}
                onClick={onDismiss}
                className="px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white/80 hover:text-white text-xs sm:text-sm font-semibold border border-white/10 transition cursor-pointer"
              >
                Dismiss
              </button>
            )}
            {hasCta && (
              <button
                type="button"
                autoFocus={!isPreview}
                onClick={onAction}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${style.btn}`}
              >
                <span>{ctaLabel?.trim()}</span>
                {isExternal && <ExternalLink className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
