"use client";

import { Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useApiFetch } from "@/lib/apiFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Topbar({ left }: { left?: ReactNode } = {}) {
  const [balance, setBalance] = useState<number | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch(`${API_URL}/api/credits`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBalance(data.balance); })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 left-0 md:left-14 right-0 z-30 flex items-center justify-between gap-3 border-b border-white/6 bg-[#0a0a0a] px-4 sm:px-6 h-12">
      <div className="flex min-w-0 items-center">{left}</div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Credits */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-2.5 sm:px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-[13px] font-semibold text-white">
            {balance === null ? "—" : balance.toLocaleString()}
          </span>
        </div>

        {/* Add more credits */}
        <Link
          href="/dashboard/billing"
          className="rounded-lg border border-white/12 bg-white/8 px-2.5 sm:px-3.5 py-1.5 text-[12px] sm:text-[13px] font-medium text-white/70 hover:bg-white/12 hover:text-white transition-colors whitespace-nowrap"
        >
          Add more credits
        </Link>
      </div>
    </header>
  );
}
