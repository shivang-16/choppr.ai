"use client";

import { useState } from "react";
import { ChevronDown, Undo2, Redo2, Share2, Download, Cloud, Sparkles } from "lucide-react";
import ChopprLogo from "@/components/choppr-logo";
import Link from "next/link";

interface Props {
  title: string;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  projectId: string;
  /** Free-plan lock when export duration exceeds the free limit */
  exportRequiresUpgrade?: boolean;
}

export default function EditorTopbar({
  title,
  onUndo,
  onRedo,
  onExport,
  canUndo,
  canRedo,
  projectId,
  exportRequiresUpgrade = false,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  return (
    <header className="flex min-h-11 items-center justify-between border-b border-white/8 bg-[#1a1a1a] px-3 py-1.5 shrink-0 z-50">
      {/* Left — logo + title */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <ChopprLogo size={28} />
        </Link>

        <div className="flex items-center gap-1">
          {editingTitle ? (
            <input
              autoFocus
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="bg-white/10 text-white text-[13px] font-medium rounded px-2 py-0.5 outline-none border border-white/20 w-40"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="flex items-center gap-1 text-[13px] font-medium text-white/80 hover:text-white transition-colors"
            >
              {localTitle}
              <ChevronDown className="h-3 w-3 text-white/40" />
            </button>
          )}
          {/* Save indicator */}
          <div className="flex items-center gap-1 text-[11px] text-white/25 ml-1">
            <Cloud className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Center — undo/redo + tools */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/8 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title="Undo (⌘Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/8 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right — share + export */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>

        {exportRequiresUpgrade ? (
          <div className="flex flex-col items-end gap-0.5 leading-tight">
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-white/90 transition-colors active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to Pro
            </Link>
            <span className="text-[9px] text-white/40 max-w-[170px] text-right">
              Upgrade to export clips greater than 5 min
            </span>
          </div>
        ) : (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-white/90 transition-colors active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
      </div>
    </header>
  );
}
