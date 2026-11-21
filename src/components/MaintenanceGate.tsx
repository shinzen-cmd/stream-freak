"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";
import { fetchSiteConfig } from "@/lib/siteConfig";

export default function MaintenanceGate() {
  const pathname = usePathname();
  const [maintenance, setMaintenance] = useState<{ on: boolean; message: string }>({
    on: false,
    message: "",
  });

  useEffect(() => {
    let active = true;
    fetchSiteConfig().then((cfg) => {
      if (active && cfg.maintenance_mode) {
        setMaintenance({ on: true, message: cfg.maintenance_message });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!maintenance.on || pathname === "/dashboard" || pathname === "/login") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#090a0f]/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-3xl bg-[#0e1118] border border-white/10 p-8 shadow-2xl flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Wrench className="w-7 h-7 text-emerald-400" />
        </div>
        <span className="text-xl font-black tracking-tight text-white">
          STREAM <span className="text-emerald-400">FREAK</span>
        </span>
        <h1 className="text-lg font-bold text-white">Quick Tune-Up in Progress</h1>
        <p className="text-sm text-white/60 leading-relaxed">{maintenance.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
        >
          Check Again
        </button>
      </div>
    </div>
  );
}
