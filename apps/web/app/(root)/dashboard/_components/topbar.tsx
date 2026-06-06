"use client";

import { Bell, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Topbar() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/credits`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBalance(data.balance); })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 left-14 right-0 z-30 flex items-center justify-end gap-3 border-b border-white/6 bg-[#0a0a0a]/80 backdrop-blur-md px-6 h-12">
      {/* Bell */}
      <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/6 hover:text-white/70 transition-colors">
        <Bell className="h-4 w-4" />
      </button>

      {/* Credits */}
      <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-3 py-1.5">
        <Zap className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-[13px] font-semibold text-white">
          {balance === null ? "—" : balance.toLocaleString()}
        </span>
      </div>

      {/* Add more credits */}
      <Link
        href="/dashboard/billing"
        className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-1.5 text-[13px] font-medium text-white/70 hover:bg-white/12 hover:text-white transition-colors whitespace-nowrap"
      >
        Add more credits
      </Link>
    </header>
  );
}
