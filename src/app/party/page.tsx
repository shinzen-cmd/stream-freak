"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Film,
  Loader2,
  LogOut,
  Maximize2,
  MessageSquare,
  MonitorUp,
  Radio,
  Send,
  Share2,
  StopCircle,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { shareOrigin } from "@/lib/apiBase";
import { useAuth } from "@/context/AuthContext";
import { recordPartyReward } from "@/lib/rewards";
import AuthGateModal from "@/components/AuthGateModal";

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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function PartyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useAuth();

  const codeParam = (searchParams.get("code") || "").trim().toUpperCase();
  const roleParam = searchParams.get("role") === "host";
  const titleParam = searchParams.get("title") || "";

  // Lobby state
  const [roomTitle, setRoomTitle] = useState(titleParam || "");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Room state
  const [activeCode, setActiveCode] = useState(codeParam);
  const [isHost, setIsHost] = useState(roleParam);
  const [activeTitle, setActiveTitle] = useState(titleParam || "Stream Freak Cinema");
  const [isSharing, setIsSharing] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Chat & Presence state
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [viewers, setViewers] = useState<string[]>([]);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);

  const peerIdRef = useRef<string>(`p_${Math.random().toString(36).slice(2, 10)}`);
  const guestNameRef = useRef<string>(`Guest-${Math.floor(1000 + Math.random() * 9000)}`);
  const displayName = user?.email ? user.email.split("@")[0] : guestNameRef.current;

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const rewardedCodeRef = useRef<string>("");

  useEffect(() => {
    setActiveCode(codeParam);
    setIsHost(roleParam);
    if (titleParam) setActiveTitle(titleParam);
  }, [codeParam, roleParam, titleParam]);

  // Award XP once per room session
  useEffect(() => {
    if (!activeCode || rewardedCodeRef.current === activeCode) return;
    rewardedCodeRef.current = activeCode;
    recordPartyReward(user?.uid ?? null, isHost);
  }, [activeCode, isHost, user?.uid]);

  const cleanupStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    hostPeersRef.current.forEach((pc) => pc.close());
    hostPeersRef.current.clear();
    viewerPeerRef.current?.close();
    viewerPeerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setStreamConnected(false);
  }, []);

  // Host: create an RTCPeerConnection for a joining viewer and send SDP offer
  const connectViewerAsHost = useCallback(async (viewerPeerId: string) => {
    const stream = localStreamRef.current;
    const ch = channelRef.current;
    if (!stream || !ch) return;

    const existing = hostPeersRef.current.get(viewerPeerId);
    if (existing) existing.close();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    hostPeersRef.current.set(viewerPeerId, pc);

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void ch.send({
          type: "broadcast",
          event: "rtc-ice",
          payload: {
            from: peerIdRef.current,
            to: viewerPeerId,
            candidate: e.candidate.toJSON(),
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        hostPeersRef.current.delete(viewerPeerId);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await ch.send({
      type: "broadcast",
      event: "rtc-offer",
      payload: {
        from: peerIdRef.current,
        to: viewerPeerId,
        sdp: pc.localDescription,
      },
    });
  }, []);

  // Connect Supabase Realtime signaling + chat + presence
  useEffect(() => {
    if (!activeCode) return;

    const myPeerId = peerIdRef.current;
    const channel = supabase.channel(`sf-p2p-party:${activeCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: `${displayName}#${myPeerId.slice(-4)}` },
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
        }, 2500);
      })
      .on("broadcast", { event: "viewer-ready" }, ({ payload }) => {
        const { from } = (payload ?? {}) as { from?: string };
        if (isHost && from && localStreamRef.current) {
          void connectViewerAsHost(from);
        }
      })
      .on("broadcast", { event: "host-stream-started" }, ({ payload }) => {
        const { title } = (payload ?? {}) as { title?: string };
        if (title) setActiveTitle(title);
        if (!isHost) {
          void channel.send({
            type: "broadcast",
            event: "viewer-ready",
            payload: { from: myPeerId },
          });
        }
      })
      .on("broadcast", { event: "host-stream-stopped" }, () => {
        if (!isHost) {
          viewerPeerRef.current?.close();
          viewerPeerRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          setStreamConnected(false);
        }
      })
      .on("broadcast", { event: "rtc-offer" }, async ({ payload }) => {
        const { from, to, sdp } = (payload ?? {}) as {
          from?: string;
          to?: string;
          sdp?: RTCSessionDescriptionInit;
        };
        if (isHost || to !== myPeerId || !from || !sdp) return;

        viewerPeerRef.current?.close();
        const pc = new RTCPeerConnection(ICE_SERVERS);
        viewerPeerRef.current = pc;

        pc.ontrack = (e) => {
          const remoteStream = e.streams[0];
          if (videoRef.current && remoteStream) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(() => {});
            setStreamConnected(true);
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            void channel.send({
              type: "broadcast",
              event: "rtc-ice",
              payload: {
                from: myPeerId,
                to: from,
                candidate: e.candidate.toJSON(),
              },
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await channel.send({
          type: "broadcast",
          event: "rtc-answer",
          payload: {
            from: myPeerId,
            to: from,
            sdp: pc.localDescription,
          },
        });
      })
      .on("broadcast", { event: "rtc-answer" }, async ({ payload }) => {
        const { from, to, sdp } = (payload ?? {}) as {
          from?: string;
          to?: string;
          sdp?: RTCSessionDescriptionInit;
        };
        if (!isHost || to !== myPeerId || !from || !sdp) return;
        const pc = hostPeersRef.current.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      })
      .on("broadcast", { event: "rtc-ice" }, async ({ payload }) => {
        const { from, to, candidate } = (payload ?? {}) as {
          from?: string;
          to?: string;
          candidate?: RTCIceCandidateInit;
        };
        if (to !== myPeerId || !from || !candidate) return;
        const pc = isHost ? hostPeersRef.current.get(from) : viewerPeerRef.current;
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const names = Object.keys(state).map((k) => k.split("#")[0]);
        setViewers(names);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: displayName, isHost, peerId: myPeerId });
          setMessages([
            {
              id: `sys-${Date.now()}`,
              sender: "Stream Freak",
              text: isHost
                ? `Room ${activeCode} is live. Share your screen & audio to begin the screening.`
                : `Joined room ${activeCode}. Waiting for the host's live feed...`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isSystem: true,
            },
          ]);
          if (!isHost) {
            await channel.send({
              type: "broadcast",
              event: "viewer-ready",
              payload: { from: myPeerId },
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      cleanupStreams();
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [activeCode, isHost, displayName, connectViewerAsHost, cleanupStreams]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStartSharing = async () => {
    setError("");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing requires a desktop browser (Chrome, Edge, Brave, or Safari). Viewers can watch from any phone or laptop.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });

      localStreamRef.current = stream;
      setIsSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleStopSharing();
        };
      }

      await channelRef.current?.send({
        type: "broadcast",
        event: "host-stream-started",
        payload: { title: activeTitle },
      });
    } catch {
      /* user cancelled picker */
    }
  };

  const handleStopSharing = () => {
    cleanupStreams();
    void channelRef.current?.send({
      type: "broadcast",
      event: "host-stream-stopped",
      payload: {},
    });
  };

  const handleCreateRoom = () => {
    if (!user) {
      setAuthGateOpen(true);
      return;
    }
    const code = generateRoomCode();
    const title = roomTitle.trim() || "Friday Night Screening";
    setActiveTitle(title);
    router.push(`/party?code=${code}&role=host&title=${encodeURIComponent(title)}`);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 4) {
      setError("Enter a valid 6-character room code.");
      return;
    }
    setError("");
    router.push(`/party?code=${cleaned}`);
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
    setMessages((prev) => [...prev.slice(-120), msg]);
    await channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
  };

  const handleReaction = async (emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const left = 12 + Math.floor(Math.random() * 76);
    setFloating((prev) => [...prev.slice(-14), { id, emoji, left }]);
    window.setTimeout(() => {
      setFloating((prev) => prev.filter((item) => item.id !== id));
    }, 2500);
    await channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  };

  const handleCopyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleCopyLink = async () => {
    if (!activeCode) return;
    const shareUrl = `${shareOrigin()}/party?code=${activeCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeTitle,
          text: `Join my Stream Freak screening — Room ${activeCode}`,
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

  const handleToggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  };

  // Active Cinema Room View
  if (activeCode) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-6 px-3 sm:px-5 lg:px-6 max-w-[1800px] mx-auto flex flex-col gap-3">
        {/* Top Room Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#0e1118] border border-white/10 rounded-2xl px-3.5 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Radio className={`w-4 h-4 ${isSharing || streamConnected ? "text-emerald-400 animate-pulse" : "text-white/50"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">{activeTitle}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {Math.max(1, viewers.length)} in room
                </span>
              </div>
              <p className="text-[11px] text-white/45">
                {isHost ? "You are hosting this screening" : "Live synced screening"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono font-bold text-white transition cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
              {activeCode}
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

            <button
              type="button"
              onClick={() => {
                cleanupStreams();
                router.replace("/party");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-semibold text-white/75 hover:text-rose-300 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Main Cinema Stage + Live Chat */}
        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-[68vh]">
          {/* Live Theater Video Stage */}
          <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#06070b] border border-white/10 min-h-[52vh] lg:min-h-[72vh] shadow-2xl flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isHost || muted}
              className={`w-full h-full object-contain ${isSharing || streamConnected ? "block" : "hidden"}`}
            />

            {/* Empty / Ready State */}
            {!isSharing && !streamConnected && (
              <div className="flex flex-col items-center justify-center text-center px-6 max-w-md gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  {isHost ? (
                    <MonitorUp className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  )}
                </div>
                {isHost ? (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-bold text-white">Ready to Roll the Film?</h2>
                      <p className="text-xs text-white/55 leading-relaxed">
                        Open your movie or anime in another tab, then share that tab with audio so everyone watches in crisp 60fps sync.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleStartSharing()}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <MonitorUp className="w-4 h-4" />
                      Share Screen &amp; Audio
                    </button>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-bold text-white">Waiting for the Host</h2>
                    <p className="text-xs text-white/55 leading-relaxed">
                      Grab your popcorn — the live screening will appear here automatically the moment the host starts streaming.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Overlay Controls when Streaming */}
            {(isSharing || streamConnected) && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {!isHost && (
                  <button
                    type="button"
                    onClick={() => {
                      setMuted((m) => {
                        const next = !m;
                        if (videoRef.current) videoRef.current.muted = next;
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/75 hover:bg-black/90 border border-white/15 text-xs font-semibold text-white backdrop-blur-md cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    {muted ? "Unmute Audio" : "Sound On"}
                  </button>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={handleStopSharing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-xs font-bold text-white backdrop-blur-md cursor-pointer"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Sharing
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  aria-label="Fullscreen"
                  className="p-2 rounded-xl bg-black/75 hover:bg-black/90 border border-white/15 text-white backdrop-blur-md cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Floating Live Emoji Reactions */}
            <div className="pointer-events-none absolute inset-x-0 bottom-14 h-44 overflow-hidden">
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
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Room Chat</span>
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

  // Lobby View
  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-4">
          <Users className="w-3.5 h-3.5" />
          Private Cinema Rooms
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
          Movie Night, Together.
        </h1>
        <p className="text-sm text-white/60 leading-relaxed">
          Host a private screening with zero-drift 60fps playback, synced audio, live chat, and real-time reactions — one invite link brings everyone to the same couch.
        </p>
      </div>

      {error && (
        <div className="mb-6 max-w-2xl mx-auto px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-300 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Host Room Card */}
        <div className="bg-[#0e1118] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Host a Screening</h2>
              <p className="text-xs text-white/45">Direct HD stream from your screen to friends</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1.5">Room Name</label>
            <input
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="Late Night Anime Marathon"
              maxLength={80}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition"
            />
          </div>

          <p className="text-xs text-white/45 leading-relaxed">
            Share any movie, anime episode, or tab with full audio. Earn <span className="text-emerald-400 font-semibold">+30 XP</span> and unlock the <span className="text-white font-semibold">Cinema Host</span> badge.
          </p>

          <button
            type="button"
            onClick={handleCreateRoom}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition cursor-pointer"
          >
            <MonitorUp className="w-4 h-4" />
            Launch Private Room
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
              <h2 className="text-base font-bold text-white">Join a Screening</h2>
              <p className="text-xs text-white/45">Got a 6-character invite code?</p>
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
            Watch live from your phone, laptop, or tablet — instant video, chat, and reactions with no extra setup.
          </p>

          <button
            type="submit"
            disabled={joinCode.trim().length < 4}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black hover:bg-white/90 text-sm font-bold transition disabled:opacity-40 cursor-pointer"
          >
            Enter Room
          </button>
        </form>
      </div>

      <AuthGateModal
        isOpen={authGateOpen}
        reason="Sign in to host a private Watch Party room and earn Cinema Host XP."
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
