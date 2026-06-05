"use client";

import { Captions, Volume2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: string;
  onChange: (panel: string) => void;
  visible: boolean; // only show when clip is selected
}

const TOOLS = [
  { id: "captions", icon: Captions, label: "Captions" },
  { id: "audio",    icon: Volume2,  label: "Audio" },
  { id: "speed",    icon: Gauge,    label: "Speed" },
];

export default function RightToolbar({ active, onChange, visible }: Props) {
  if (!visible) return <div className="w-[72px] shrink-0 border-l border-white/6 bg-[#111]" />;

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-l border-white/6 bg-[#111] pt-3 pb-4">
      {TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id === active ? "" : id)}
          className={cn(
            "flex flex-col items-center gap-1 w-14 py-2.5 rounded-xl text-[9px] transition-colors",
            active === id
              ? "bg-white/12 text-white"
              : "text-white/35 hover:bg-white/6 hover:text-white/70"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="leading-none">{label}</span>
        </button>
      ))}
    </div>
  );
}
