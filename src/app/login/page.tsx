"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import {
  EmailOtpType,
  resendEmailOtp,
  sendLoginOtp,
  signIn,
  verifyEmailOtp,
} from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 6-digit OTP verification state
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpType, setOtpType] = useState<EmailOtpType>("signup");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp") {
      window.setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 60);
    }
  }, [step]);

  function openOtpStep(type: EmailOtpType, infoMessage?: string) {
    setOtpType(type);
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setError("");
    setNotice(infoMessage ?? "");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("otp");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "login" && loginMethod === "otp") {
      const { error: otpErr } = await sendLoginOtp(normalizedEmail);
      setLoading(false);
      if (otpErr) {
        setError(otpErr);
        return;
      }
      openOtpStep("email", "We sent a 6-digit sign-in code to your email.");
      return;
    }

    const { user, error: err, needsVerification, otpType: nextOtpType } = await signIn(
      normalizedEmail,
      password,
      mode
    );

    if (needsVerification) {
      setLoading(false);
      openOtpStep(
        nextOtpType ?? "signup",
        mode === "register"
          ? "We sent a 6-digit verification code to confirm your account."
          : "Your email isn't verified yet. We sent a fresh 6-digit code."
      );
      return;
    }

    if (err || !user) {
      setLoading(false);
      setError(err || "Invalid credentials");
      return;
    }

    await refresh();
    // Always land on the main page; admins reach /dashboard via the profile menu.
    router.replace("/");
  }

  async function submitOtpCode(code: string) {
    if (loading) return;
    setError("");
    setNotice("");
    setLoading(true);

    const { user, error: err } = await verifyEmailOtp(email, code, otpType);
    if (err || !user) {
      setLoading(false);
      setError(err || "Invalid or expired code.");
      return;
    }

    await refresh();
    router.replace("/");
  }

  async function handleVerifyFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    await submitOtpCode(code);
  }

  function handleOtpChange(index: number, rawValue: string) {
    const cleaned = rawValue.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      setError("");
      return;
    }

    // Handle multi-digit paste or mobile OS OTP autofill into a single input
    const next = [...otpDigits];
    let cursor = index;
    for (const ch of cleaned) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = ch;
      cursor++;
    }
    setOtpDigits(next);
    setError("");

    const focusIdx = Math.min(cursor, OTP_LENGTH - 1);
    otpInputRefs.current[focusIdx]?.focus();

    const joined = next.join("");
    if (joined.length === OTP_LENGTH && next.every((d) => d.length === 1)) {
      void submitOtpCode(joined);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
      } else if (index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
        otpInputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    setError("");
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    otpInputRefs.current[focusIdx]?.focus();
    if (pasted.length === OTP_LENGTH) {
      void submitOtpCode(pasted);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    const { error: resendErr } = await resendEmailOtp(email, otpType);
    setResending(false);
    if (resendErr) {
      setError(resendErr);
      return;
    }
    setNotice("A new 6-digit code has been sent to your email.");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    otpInputRefs.current[0]?.focus();
  }

  const input =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition";

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-tight text-white">
            STREAM <span className="text-emerald-400">FREAK</span>
          </span>
        </div>

        {step === "otp" ? (
          <form
            onSubmit={handleVerifyFormSubmit}
            className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-5"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setError("");
                  setNotice("");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                Email Verification
              </span>
            </div>

            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-2">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold text-white">Check your inbox</h1>
              <p className="text-xs text-white/55 leading-relaxed">
                Enter the 6-digit code sent to{" "}
                <span className="text-white font-semibold break-all">{email.trim().toLowerCase()}</span>
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  aria-label={`Digit ${idx + 1}`}
                  className="w-11 h-12 sm:w-12 sm:h-13 text-center text-lg font-bold text-white bg-white/[0.05] border border-white/15 rounded-xl outline-none focus:border-emerald-400 focus:bg-emerald-500/[0.06] transition"
                />
              ))}
            </div>

            {notice && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{notice}</span>
              </p>
            )}

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || otpDigits.join("").length !== OTP_LENGTH}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify &amp; Continue
            </button>

            <div className="flex flex-col items-center gap-1.5 pt-1 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/65 hover:text-emerald-400 disabled:text-white/30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : resending
                  ? "Sending..."
                  : "Resend 6-digit code"}
              </button>
              <p className="text-[11px] text-white/35 text-center">
                Don&apos;t see it? Check Spam or Promotions in Gmail.
              </p>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex p-1 bg-white/[0.04] rounded-xl">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setNotice("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    mode === m ? "bg-white text-black" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "login" && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("password");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    loginMethod === "password"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-white/[0.02] border-white/[0.08] text-white/50 hover:text-white/80"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("otp");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    loginMethod === "otp"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-white/[0.02] border-white/[0.08] text-white/50 hover:text-white/80"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  6-Digit Code
                </button>
              </div>
            )}

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email address"
              className={input}
            />

            {(mode === "register" || loginMethod === "password") && (
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Password (min. 8 characters)"
                  className={`${input} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {mode === "register" && (
              <p className="text-[11px] text-white/45 leading-relaxed -mt-1">
                We&apos;ll send a 6-digit verification code to your email to activate your account.
              </p>
            )}

            {mode === "login" && loginMethod === "otp" && (
              <p className="text-[11px] text-white/45 leading-relaxed -mt-1">
                No password needed — we&apos;ll email a 6-digit sign-in code directly to your inbox.
              </p>
            )}

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" && loginMethod === "otp" ? "Send 6-Digit Code" : "Continue"}
            </button>

            <div className="flex items-center gap-3 my-0.5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] uppercase tracking-wider text-white/35 font-semibold">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <GoogleSignInButton
              onError={setError}
              onSuccess={async () => {
                await refresh();
                router.replace("/");
              }}
            />
          </form>
        )}
      </div>
    </div>
  );
}
