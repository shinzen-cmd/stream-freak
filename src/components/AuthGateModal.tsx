"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Lock, Mail } from "lucide-react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

interface AuthGateModalProps {
  isOpen: boolean;
  reason?: string;
  onClose: () => void;
  onAuthenticated: () => Promise<void>;
}

/**
 * Reusable sign-in prompt shown to guests when accessing gated features
 * (Watchlist, Downloads, Auto-Skip, or Backup Servers).
 */
export default function AuthGateModal({
  isOpen,
  reason,
  onClose,
  onAuthenticated,
}: AuthGateModalProps) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setError("");
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in required"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[#0e1017] border border-white/15 p-5 sm:p-6 shadow-2xl text-white"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sign In Required</h3>
              <p className="text-xs text-white/50">Free Stream Freak account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-white/75 leading-relaxed mb-5">
          {reason || "Sign in to unlock Watchlist sync, Downloads, Auto-Skip Intro/Outro, and Backup Servers."}
        </p>

        <div className="flex flex-col gap-2.5">
          <GoogleSignInButton
            onError={setError}
            onSuccess={async () => {
              await onAuthenticated();
              onClose();
            }}
          />

          <button
            type="button"
            autoFocus
            onClick={() => {
              onClose();
              router.push("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Sign In with Email</span>
          </button>

          {error && <p className="text-xs text-rose-400 text-center pt-1">{error}</p>}

          <button
            type="button"
            onClick={onClose}
            className="mt-1 py-2 text-xs font-medium text-white/45 hover:text-white transition cursor-pointer"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
