import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  uid: string;
  email: string;
  role: "admin" | "user";
  pfp?: string;
}

let socialInitialized = false;

export type EmailOtpType = "signup" | "email";

export interface SignInResult {
  user: AuthUser | null;
  error: string | null;
  needsVerification?: boolean;
  otpType?: EmailOtpType;
}

export async function signIn(
  email: string,
  password: string,
  mode: "login" | "register" = "login"
): Promise<SignInResult> {
  email = email.trim().toLowerCase();
  if (mode === "register") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { user: null, error: error.message };
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        user: null,
        error: "An account with this email already exists. Please sign in instead.",
      };
    }
    if (!data.session) {
      return { user: null, error: null, needsVerification: true, otpType: "signup" };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const errCode = (error as { code?: string }).code;
      if (errCode === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: "signup", email });
        return { user: null, error: null, needsVerification: true, otpType: "signup" };
      }
      return { user: null, error: "Invalid email or password" };
    }
  }
  const user = await getSession();
  return { user, error: user ? null : "Sign in failed" };
}

/**
 * Sends a 6-digit login verification code to an existing account's email.
 */
export async function sendLoginOtp(email: string): Promise<{ error: string | null }> {
  email = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    if (/signups not allowed/i.test(error.message)) {
      return { error: "No account found with this email. Create an account first." };
    }
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Verifies an email OTP code (6 or 8 digits, matching Supabase's Email OTP setting)
 * for either new-account confirmation or passwordless login.
 */
export async function verifyEmailOtp(
  email: string,
  token: string,
  type: EmailOtpType
): Promise<{ user: AuthUser | null; error: string | null }> {
  email = email.trim().toLowerCase();
  const cleanedToken = token.replace(/\D/g, "").slice(0, 8);
  if (cleanedToken.length < 6) {
    return { user: null, error: "Please enter the full verification code." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: cleanedToken,
    type,
  });
  if (error) {
    if (/expired|invalid/i.test(error.message)) {
      return { user: null, error: "Invalid or expired code. Please check the code or resend a new one." };
    }
    return { user: null, error: error.message };
  }

  const user = await getSession();
  return { user, error: user ? null : "Verification succeeded, but session could not be loaded. Please try signing in." };
}

/**
 * Resends a 6-digit email verification code.
 */
export async function resendEmailOtp(
  email: string,
  type: EmailOtpType
): Promise<{ error: string | null }> {
  email = email.trim().toLowerCase();
  if (type === "signup") {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error ? error.message : null };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  return { error: error ? error.message : null };
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
