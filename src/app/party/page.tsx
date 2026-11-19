"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Film,
  Loader2,
  LogOut,
  MessageSquare,
  Power,
  Send,
  Share2,
  Tv,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import AuthGateModal from "@/components/AuthGateModal";

interface PartyRoom {
  code: string;
  title: string;
  host_id: string | null;
  host_name: string;
  embed_url: string;
  active: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

const REACTIONS = ["🍿", "🔥", "😂", "😮", "❤️", "👏"];

function PartyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useAuth();

  const codeParam = (searchParams.get("code") || "").trim().toUpperCase();
  const startUrlParam = searchParams.get("url") || "";
  const titleParam = searchParams.get("title") || "";

  // Lobby state
  const [roomTitle, setRoomTitle] = useState(titleParam || "");
  const [startUrl, setStartUrl] = useState(startUrlParam || "");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Active room state
  const [room, setRoom] = useState<PartyRoom | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [ending, setEnding] = useState(false);

  // Chat & Presence state
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [viewers, setViewers] = useState<string[]>([]);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const guestNameRef = useRef<string>(`Guest-${Math.floor(1000 + Math.random() * 9000)}`);

  const displayName = user?.email ? user.email.split("@")[0] : guestNameRef.current;

  // Load room whenever ?code= changes
  useEffect(() => {
    if (!codeParam) {
      setRoom(null);
      return;
    }

    let cancelled = false;
    setLoadingRoom(true);
    setError("");

    fetch(`/api/party?code=${encodeURIComponent(codeParam)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { room?: PartyRoom; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.room) {
          setError(json.error || "Watch Party room not found or ended.");
          setRoom(null);
        } else {
          setRoom(json.room);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not connect to Watch Party server.");
          setRoom(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRoom(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codeParam]);

  // Connect Supabase Realtime Broadcast + Presence for the active room
  useEffect(() => {
    if (!room?.code) return;

    const channel = supabase.channel(`watch-party:${room.code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: displayName },
      },
    });

    channel
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        if (!msg?.id || !msg?.text) return;
        setMessages((prev) => [...prev.slice(-120), msg]);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const emoji = (payload as { emoji?: string })?.emoji;
        if (!emoji) return;
        const id = `${Date.now()}-${Math.random()}`;
        const left = 12 + Math.floor(Math.random() * 76);
        setFloating((prev) => [...prev.slice(-14), { id, emoji, left }]);
        window.setTimeout(() => {
          setFloating((prev) => prev.filter((item) => item.id !== id));
        }, 2600);
      })
      .on("broadcast", { event: "ended" }, () => {
        setRoom(null);
        setError("The host ended this Watch Party.");
        router.replace("/party");
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const names = Object.keys(state);
        setViewers(names);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: displayName, joined_at: new Date().toISOString() });
          setMessages([
            {
              id: `sys-${Date.now()}`,
              sender: "Stream Freak",
              text: `Welcome to ${room.title}! Share the room code ${room.code} to invite friends.`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isSystem: true,
            },
          ]);
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [room?.code, room?.title, displayName, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateRoom = useCallback(async () => {
    if (!user) {
      setAuthGateOpen(true);
      return;
    }

    setCreating(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setCreating(false);
        setAuthGateOpen(true);
        return;
      }

      const res = await fetch("/api/party", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: roomTitle.trim() || "Stream Freak Watch Party",
          startUrl: startUrl.trim() || undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { room?: PartyRoom; error?: string };
      if (!res.ok || !json.room) {
        setError(json.error || "Could not launch Watch Party.");
        setCreating(false);
        return;
      }

      setRoom(json.room);
      router.replace(`/party?code=${encodeURIComponent(json.room.code)}`);
    } catch {
      setError("Network error while creating Watch Party.");
    } finally {
      setCreating(false);
    }
  }, [user, roomTitle, startUrl, router]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 4) {
      setError("Enter a valid room code (e.g. A7K9M2).");
      return;
    }
    setJoining(true);
    setError("");
    router.push(`/party?code=${encodeURIComponent(cleaned)}`);
    window.setTimeout(() => setJoining(false), 600);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !channelRef.current) return;
    setChatInput("");
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: displayName,
      text: text.slice(0, 400),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    await channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
  };

  const handleReaction = async (emoji: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  };

  const handleCopyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleCopyLink = async () => {
    if (!room) return;
    const shareUrl = `${window.location.origin}/party?code=${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: room.title,
          text: `Join my Stream Freak Watch Party! Room code: ${room.code}`,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleEndRoom = async () => {
    if (!room || ending) return;
    setEnding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      await channelRef.current?.send({ type: "broadcast", event: "ended", payload: {} });
      await fetch(`/api/party?code=${encodeURIComponent(room.code)}`, {
        method: "DELETE",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } finally {
      setEnding(false);
      setRoom(null);
      router.replace("/party");
    }
  };

  const isHost = Boolean(user && room && (room.host_id === user.uid || user.role === "admin"));

  if (loadingRoom) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 flex flex-col items-center justify-center text-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-white/70">Connecting to Watch Party room <span className="font-bold text-white">{codeParam}</span>...</p>
      </div>
    );
  }

  // Active Cinema Room View
  if (room) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-6 px-3 sm:px-5 lg:px-6 max-w-[1800px] mx-auto flex flex-col gap-3">
        {/* Top Room Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#0e1118] border border-white/10 rounded-2xl px-3.5 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">{room.title}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {Math.max(1, viewers.length)} watching
                </span>
              </div>
              <p className="text-[11px] text-white/45 truncate">Hosted by {room.host_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono font-bold text-white transition cursor-pointer"
              title="Copy room code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
              {room.code}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {copiedLink ? "Link Copied" : "Invite"}
            </button>

            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                chatOpen
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.04] border-white/10 text-white/65 hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>

            {isHost ? (
              <button
                type="button"
                onClick={handleEndRoom}
                disabled={ending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 transition cursor-pointer disabled:opacity-50"
              >
                {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                End Party
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRoom(null);
                  router.replace("/party");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/75 hover:text-white transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Leave
              </button>
            )}
          </div>
        </div>

        {/* Main Cinema Stage + Live Chat */}
        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-[68vh]">
          {/* Hyperbeam Shared Virtual Browser */}
          <div className="relative flex-1 rounded-2xl overflow-hidden bg-black border border-white/10 min-h-[52vh] lg:min-h-[72vh] shadow-2xl">
            <iframe
              src={room.embed_url}
              title={room.title}
              className="w-full h-full min-h-[52vh] lg:min-h-[72vh] border-0"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write; microphone; camera"
              allowFullScreen
            />

            {/* Floating Live Emoji Reactions */}
            <div className="pointer-events-none absolute inset-x-0 bottom-4 h-44 overflow-hidden">
              {floating.map((item) => (
                <span
                  key={item.id}
                  style={{ left: `${item.left}%` }}
                  className="absolute bottom-0 text-3xl animate-bounce drop-shadow-lg select-none"
                >
                  {item.emoji}
                </span>
              ))}
            </div>
          </div>

          {/* Live Chat Panel */}
          {chatOpen && (
            <aside className="w-full lg:w-80 xl:w-96 rounded-2xl bg-[#0e1118] border border-white/10 flex flex-col overflow-hidden max-h-[52vh] lg:max-h-[72vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Party Chat</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  aria-label="Close chat"
                  className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.isSystem
                        ? "text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2"
                        : "bg-white/[0.04] rounded-xl px-3 py-2"
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[11px] font-bold text-emerald-400 truncate">{m.sender}</span>
                      <span className="text-[10px] text-white/30 shrink-0">{m.time}</span>
                    </div>
                    <p className="text-xs text-white/85 break-words leading-relaxed">{m.text}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Reactions Bar */}
              <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between gap-1 bg-white/[0.015]">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void handleReaction(emoji)}
                    className="flex-1 py-1 rounded-lg hover:bg-white/10 active:scale-95 text-base transition cursor-pointer"
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-white/[0.07] flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something..."
                  maxLength={400}
                  className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50 transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  aria-label="Send message"
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // Lobby View (Create or Join)
  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-4">
          <Users className="w-3.5 h-3.5" />
          Shared Cloud Cinema
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
          Watch Party
        </h1>
        <p className="text-sm text-white/60 leading-relaxed">
          Spin up a shared virtual browser in the cloud, invite your friends or loved ones with one link, and stream movies, shows, or anime together in perfect sync with live chat.
        </p>
      </div>

      {error && (
        <div className="mb-6 max-w-2xl mx-auto px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-300 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Create Room Card */}
        <div className="bg-[#0e1118] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Start a Watch Party</h2>
              <p className="text-xs text-white/45">Launch a private ad-blocked cloud room</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Room Name</label>
              <input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="Friday Movie Night"
                maxLength={80}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition"
              />
            </div>

            <div>
              <label className="text-xs text-white/50 block mb-1.5">Starting Page (Optional)</label>
              <input
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="Defaults to Stream Freak homepage"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateRoom()}
            disabled={creating}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-60 cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Launching Cloud Room...
              </>
            ) : (
              <>
                <Tv className="w-4 h-4" />
                Create Watch Party
              </>
            )}
          </button>
        </div>

        {/* Join Room Card */}
        <form
          onSubmit={handleJoinSubmit}
          className="bg-[#0e1118] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Join with Room Code</h2>
              <p className="text-xs text-white/45">Got a 6-character code from a friend?</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1.5">Room Code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. A7K9M2"
              maxLength={8}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.25em] uppercase text-white placeholder:text-white/20 placeholder:tracking-normal outline-none focus:border-sky-400/60 transition"
            />
          </div>

          <p className="text-xs text-white/45 leading-relaxed">
            Anyone with the invite link or room code can join directly from their browser — no extra apps or extensions required.
          </p>

          <button
            type="submit"
            disabled={joining || joinCode.trim().length < 4}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black hover:bg-white/90 text-sm font-bold transition disabled:opacity-40 cursor-pointer"
          >
            {joining && <Loader2 className="w-4 h-4 animate-spin" />}
            Join Watch Party
          </button>
        </form>
      </div>

      <AuthGateModal
        isOpen={authGateOpen}
        reason="Sign in to launch a private Watch Party cloud room and invite friends."
        onClose={() => setAuthGateOpen(false)}
        onAuthenticated={async () => {
          await refresh();
        }}
      />
    </div>
  );
}

export default function PartyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <PartyPageInner />
    </Suspense>
  );
}
