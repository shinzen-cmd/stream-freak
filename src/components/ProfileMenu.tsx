"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, LogOut, Bookmark, LayoutDashboard, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const CHAR_IDS = [17, 40, 246, 45627, 14, 62, 127691, 146156, 80, 73935, 40881, 138101, 5, 3, 67, 35252];
const CACHE_KEY = "sf_avatar_catalog_v1";

export interface AvatarOpt { id: number; name: string; img: string }

export function useAvatars() {
  const [list, setList] = useState<AvatarOpt[]>([]);
  useEffect(() => {
    try {
      const c = sessionStorage.getItem(CACHE_KEY);
      if (c) { setList(JSON.parse(c)); return; }
    } catch {}
    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($ids:[Int]){Page(perPage:30){characters(id_in:$ids){id name{full} image{large}}}}`,
        variables: { ids: CHAR_IDS },
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        const out: AvatarOpt[] = (j?.data?.Page?.characters ?? []).map((c: any) => ({
          id: c.id, name: c.name.full, img: c.image.large,
        }));
        setList(out);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch {}
      })
      .catch(() => {});
  }, []);
  return list;
}

export default function ProfileMenu() {
  const { user, isTvDevice, logout, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const avatars = useAvatars();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const circle =
    "w-8 h-8 xs:w-10 xs:h-10 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center hover:border-emerald-400/60 transition shrink-0";

  if (!user) {
    // TV APK runs login-free without surfacing a sign-in button
    if (isTvDevice) return null;
    return (
      <Link href="/login" aria-label="Sign in" className={circle}>
        <User className="w-4 h-4 xs:w-5 xs:h-5 text-gray-300" />
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Profile" className={circle}>
        {user.pfp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.pfp} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-emerald-300">{user.email[0].toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-[#0e1017] border border-white/15 rounded-2xl p-3 shadow-2xl z-[60]">
          <p className="text-xs text-white/50 truncate px-1 pb-2 border-b border-white/5">{user.email}</p>

          <div className="grid grid-cols-4 gap-2 py-3">
            {avatars.map((a) => {
              const active = user.pfp === a.img;
              return (
                <button
                  key={a.id}
                  title={a.name}
                  onClick={() => updateProfile({ pfp: a.img })}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 transition ${active ? "border-emerald-400" : "border-transparent hover:border-white/30"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={a.name} className="w-full h-full object-cover" />
                  {active && (
                    <span className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-0.5 border-t border-white/5 pt-2">
            <Link href="/watchlist" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5">
              <Bookmark className="w-4 h-4 text-emerald-400" /> Saved
            </Link>
            {user.role === "admin" && (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5">
                <LayoutDashboard className="w-4 h-4 text-emerald-400" /> Dashboard
              </Link>
            )}
            <button
              onClick={async () => { await logout(); setOpen(false); }}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-white/60 hover:text-rose-400 hover:bg-rose-500/5 text-left"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
