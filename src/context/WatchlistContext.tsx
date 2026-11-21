"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { MediaItem, WatchHistoryItem } from "@/types/media";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { recordWatchReward } from "@/lib/rewards";

interface WatchlistContextType {
  watchlist: MediaItem[];
  continueWatching: WatchHistoryItem[];
  addToWatchlist: (item: MediaItem) => void;
  removeFromWatchlist: (id: string | number) => void;
  toggleWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string | number) => boolean;
  updateContinueWatching: (item: WatchHistoryItem) => void;
  removeFromHistory: (id: string | number) => void;
  clearHistory: () => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

const WATCHLIST_STORAGE_KEY = "cineverse_watchlist";
const HISTORY_STORAGE_KEY = "cineverse_history";

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, loading: authLoading, canAccessMemberFeatures, openAuthGate } = useAuth();
  const [loadedKey, setLoadedKey] = useState("");
  const uid = user?.uid ?? "guest";
  const wlKey = uid === "guest" ? WATCHLIST_STORAGE_KEY : `sf_watchlist_${uid}`;
  const hiKey = uid === "guest" ? HISTORY_STORAGE_KEY : `sf_history_${uid}`;

  useEffect(() => {
    if (authLoading) return;
    try {
      const savedWatchlist = localStorage.getItem(wlKey);
      const savedHistory = localStorage.getItem(hiKey);
      setWatchlist(savedWatchlist ? JSON.parse(savedWatchlist) : []);
      setContinueWatching(savedHistory ? JSON.parse(savedHistory) : []);
    } catch (e) {
      console.error("Failed to parse stored watchlist/history:", e);
    } finally {
      setIsLoaded(true);
      setLoadedKey(wlKey + hiKey);
    }
  }, [authLoading, wlKey, hiKey]);

  useEffect(() => {
    if (!isLoaded || loadedKey !== wlKey + hiKey) return;
    try {
      localStorage.setItem(wlKey, JSON.stringify(watchlist));
    } catch (e) {
      console.error("Failed to save watchlist:", e);
    }
  }, [watchlist, isLoaded, loadedKey, wlKey, hiKey]);

  useEffect(() => {
    if (!isLoaded || loadedKey !== wlKey + hiKey) return;
    try {
      localStorage.setItem(hiKey, JSON.stringify(continueWatching));
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  }, [continueWatching, isLoaded, loadedKey, wlKey, hiKey]);


  // -- Cloud sync (Supabase) for signed-in users --
  const [syncedUid, setSyncedUid] = useState("");
  useEffect(() => {
    if (!user || loadedKey !== wlKey + hiKey || syncedUid === user.uid) return;
    let cancelled = false;
    supabase
      .from("user_data")
      .select("watchlist,history")
      .eq("user_id", user.uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const uniq = <T extends { id: string | number }>(a: T[]) => {
          const seen = new Set<string>();
          return a.filter((x) => (seen.has(String(x.id)) ? false : (seen.add(String(x.id)), true)));
        };
        if (data) {
          setWatchlist((l) => uniq([...(data.watchlist ?? []), ...l]));
          setContinueWatching((l) => uniq([...l, ...(data.history ?? [])] as any) as any);
        }
        setSyncedUid(user.uid);
      });
    return () => { cancelled = true; };
  }, [user, loadedKey, wlKey, hiKey, syncedUid]);

  useEffect(() => {
    if (!user || syncedUid !== user.uid) return;
    const t = setTimeout(() => {
      supabase.from("user_data").upsert({
        user_id: user.uid,
        watchlist,
        history: continueWatching,
        updated_at: new Date().toISOString(),
      }).then(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [watchlist, continueWatching, user, syncedUid]);
  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const addToWatchlist = useCallback((item: MediaItem) => {
    if (!canAccessMemberFeatures) {
      openAuthGate("Sign in to save titles to your Watchlist.");
      return;
    }
    setWatchlist((prev) => {
      if (prev.some((i) => String(i.id) === String(item.id))) return prev;
      return [item, ...prev];
    });
  }, [canAccessMemberFeatures, openAuthGate]);

  const removeFromWatchlist = useCallback((id: string | number) => {
    setWatchlist((prev) => prev.filter((i) => String(i.id) !== String(id)));
  }, []);

  const isInWatchlist = useCallback(
    (id: string | number) => {
      return watchlist.some((i) => String(i.id) === String(id));
    },
    [watchlist]
  );

  const toggleWatchlist = useCallback(
    (item: MediaItem) => {
      if (!canAccessMemberFeatures) {
        openAuthGate("Sign in to save titles to your Watchlist.");
        return;
      }
      setWatchlist((prev) => {
        const exists = prev.some((i) => String(i.id) === String(item.id));
        if (exists) {
          return prev.filter((i) => String(i.id) !== String(item.id));
        } else {
          return [item, ...prev];
        }
      });
    },
    [canAccessMemberFeatures, openAuthGate]
  );

  const rewardedSessionRef = useRef<Set<string>>(new Set());

  const updateContinueWatching = useCallback((item: WatchHistoryItem) => {
    setContinueWatching((prev) => {
      const filtered = prev.filter((i) => String(i.id) !== String(item.id));
      return [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 20);
    });
    const rewardKey = `${item.mediaType}:${item.id}:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}`;
    if (!rewardedSessionRef.current.has(rewardKey)) {
      rewardedSessionRef.current.add(rewardKey);
      recordWatchReward(user?.uid ?? null, item.mediaType === "anime");
    }
  }, [user?.uid]);

  const removeFromHistory = useCallback((id: string | number) => {
    setContinueWatching((prev) => prev.filter((i) => String(i.id) !== String(id)));
  }, []);

  const clearHistory = useCallback(() => {
    setContinueWatching([]);
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const toggleSearch = useCallback(() => setIsSearchOpen((prev) => !prev), []);

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        continueWatching,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        isInWatchlist,
        updateContinueWatching,
        removeFromHistory,
        clearHistory,
        isSearchOpen,
        openSearch,
        closeSearch,
        toggleSearch,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
}
