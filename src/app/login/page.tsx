"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { user, error: err } = await signIn(email, password, mode);
    if (err || !user) {
      setLoading(false);
      setError(err || "Invalid credentials");
      return;
    }
    await refresh();
    // Always land on the main page; admins reach /dashboard via the profile menu.
    router.replace("/");
  }

  const input =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-emerald-500/60 transition";

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-tight text-white">
            STREAM <span className="text-emerald-400">FREAK</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex p-1 bg-white/[0.04] rounded-xl">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${mode === m ? "bg-white text-black" : "text-white/50"}`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className={input} />

          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Password"
              className={`${input} pr-10`}
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue
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
      </div>
    </div>
  );
}
