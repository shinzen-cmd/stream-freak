import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  uid: string;
  email: string;
  role: "admin" | "user";
  pfp?: string;
}

let socialInitialized = false;

export async function signIn(
  email: string,
  password: string,
  mode: "login" | "register" = "login"
): Promise<{ user: AuthUser | null; error: string | null }> {
  email = email.trim().toLowerCase();
  if (mode === "register") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { user: null, error: error.message };
    if (!data.session) return { user: null, error: "Check your email to confirm your account, then sign in." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: "Invalid credentials" };
  }
  const user = await getSession();
  return { user, error: user ? null : "Sign in failed" };
}

/**
 * Signs in with Google natively via @capgo/capacitor-social-login + Supabase ID token
 * on Capacitor mobile builds, falling back to Supabase OAuth on web.
 */
export async function signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
  if (Capacitor.isNativePlatform()) {
    const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      return {
        user: null,
        error: "Google Sign-In is not configured yet (missing NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID).",
      };
    }

    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      if (!socialInitialized) {
        await SocialLogin.initialize({
          google: { webClientId },
        });
        socialInitialized = true;
      }

      const res = await SocialLogin.login({
        provider: "google",
        options: {},
      });

      const idToken = (res.result as { idToken?: string | null } | undefined)?.idToken;
      if (!idToken) {
        return { user: null, error: "Google did not return an ID token." };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) return { user: null, error: error.message };

      const user = await getSession();
      return { user, error: user ? null : "Google sign in failed" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      const code = (err as { code?: string } | null)?.code;
      if (code === "USER_CANCELLED" || /cancel/i.test(msg)) {
        return { user: null, error: null };
      }
      return { user: null, error: msg || "Google sign in failed" };
    }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
    },
  });
  if (error) return { user: null, error: error.message };
  return { user: null, error: null };
}

export async function getSession(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const { data: p } = await supabase.from("profiles").select("role,pfp").eq("id", u.id).maybeSingle();
  return {
    uid: u.id,
    email: u.email ?? "",
    role: p?.role === "admin" ? "admin" : "user",
    pfp: p?.pfp ?? undefined,
  };
}

export async function signOut(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      await SocialLogin.logout({ provider: "google" });
    } catch {
      /* ignore if not signed in via Google */
    }
  }
  await supabase.auth.signOut();
}

export async function savePfp(uid: string, pfp: string) {
  await supabase.from("profiles").update({ pfp }).eq("id", uid);
}
