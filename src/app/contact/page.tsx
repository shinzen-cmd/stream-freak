"use client";

import React, { useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageSquarePlus, Send } from "lucide-react";

const ADMIN_EMAIL = "taktshinzen@gmail.com";

const CATEGORIES = [
  { id: "Movie / Show Request", label: "Movie / Show Request" },
  { id: "Bug Report", label: "Bug Report" },
  { id: "Feature Idea", label: "Feature Idea" },
  { id: "General Support", label: "General Support" },
];

export default function ContactPage() {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const buildEmailFields = () => {
    const cleanSubject = subject.trim()
      ? `[Stream Freak - ${category}] ${subject.trim()}`
      : `[Stream Freak - ${category}]`;
    const bodyLines = [
      name.trim() ? `From: ${name.trim()}` : null,
      `Category: ${category}`,
      "",
      message.trim(),
    ].filter((v): v is string => v !== null);
    return {
      su: cleanSubject,
      body: bodyLines.join("\n"),
    };
  };

  const handleMailtoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    const { su, body } = buildEmailFields();
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
  };

  const handleOpenGmail = () => {
    const { su, body } = buildEmailFields();
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      ADMIN_EMAIL
    )}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(ADMIN_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const inputCls =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/60 transition";

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-3">
          <MessageSquarePlus className="w-3.5 h-3.5" />
          Contact &amp; Suggestions
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
          Reach the Stream Freak Team
        </h1>
        <p className="text-sm text-white/60">
          Request a movie or anime, report a broken server, or share an idea directly with the admin.
        </p>
      </div>

      <form
        onSubmit={handleMailtoSubmit}
        className="bg-[#0e1118] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-xl"
      >
        {/* Direct Email Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <div className="flex items-center gap-2 text-xs text-white/75">
            <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Direct Gmail:</span>
            <span className="font-semibold text-white">{ADMIN_EMAIL}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-semibold text-white/80 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Category Pills */}
        <div>
          <label className="text-xs text-white/50 block mb-2">Topic</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  category === c.id
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-white/[0.03] border-white/[0.08] text-white/55 hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Your Name (Optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={60}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Add Jujutsu Kaisen S3"
              maxLength={120}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50 block mb-1.5">Message / Suggestion</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder="Write your suggestion, request, or issue here..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="submit"
            disabled={!message.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send via Mail App
          </button>
          <button
            type="button"
            onClick={handleOpenGmail}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-sm font-semibold transition cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-emerald-400" />
            Open in Gmail Web
          </button>
        </div>
      </form>
    </div>
  );
}
