"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { MediaItem, WatchHistoryItem } from "@/types/media";

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

  useEffect(() => {
    try {
      const savedWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
      if (savedHistory) setContinueWatching(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Failed to parse stored watchlist/history:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch (e) {
      console.error("Failed to save watchlist:", e);
    }
  }, [watchlist, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(continueWatching));
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  }, [continueWatching, isLoaded]);

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
    setWatchlist((prev) => {
      if (prev.some((i) => String(i.id) === String(item.id))) return prev;
      return [item, ...prev];
    });
  }, []);

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
      setWatchlist((prev) => {
        const exists = prev.some((i) => String(i.id) === String(item.id));
        if (exists) {
          return prev.filter((i) => String(i.id) !== String(item.id));
        } else {
          return [item, ...prev];
        }
      });
    },
    []
  );

  const updateContinueWatching = useCallback((item: WatchHistoryItem) => {
    setContinueWatching((prev) => {
      const filtered = prev.filter((i) => String(i.id) !== String(item.id));
      return [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 20);
    });
  }, []);

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
