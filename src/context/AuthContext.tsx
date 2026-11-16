"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthUser, getSession, signOut as apiSignOut, savePfp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { isTvDevice as detectTvDevice } from "@/lib/device";
import AuthGateModal from "@/components/AuthGateModal";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isTvDevice: boolean;
  canAccessMemberFeatures: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<AuthUser>) => void;
  openAuthGate: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isTvDevice: false, canAccessMemberFeatures: false,
  refresh: async () => {}, logout: async () => {}, updateProfile: () => {}, openAuthGate: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTvDevice, setIsTvDevice] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    setIsTvDevice(detectTvDevice());
  }, []);

  const canAccessMemberFeatures = Boolean(user) || isTvDevice;

  const openAuthGate = useCallback((reason?: string) => {
    // TV APK installs run login-free without prompting for Google/email sign-in
    if (isTvDevice || detectTvDevice()) return;
    setGateReason(reason);
    setGateOpen(true);
  }, [isTvDevice]);

  const refresh = useCallback(async () => {
    setUser(await getSession());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        // defer: never call supabase inside the auth callback synchronously
        setTimeout(refresh, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiSignOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (patch.pfp) savePfp(prev.uid, patch.pfp);
      return { ...prev, ...patch, role: prev.role, uid: prev.uid };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isTvDevice, canAccessMemberFeatures, refresh, logout, updateProfile, openAuthGate }}
    >
      {children}
      {!isTvDevice && (
        <AuthGateModal
          isOpen={gateOpen}
          reason={gateReason}
          onClose={() => setGateOpen(false)}
          onAuthenticated={refresh}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
