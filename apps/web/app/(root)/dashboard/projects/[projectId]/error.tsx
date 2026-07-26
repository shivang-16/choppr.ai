"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function ProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="flex max-w-sm flex-col items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-[14px] font-medium text-red-300">Something went wrong</p>
        </div>
        <p className="text-[13px] text-white/45 leading-snug">
          This project page hit an unexpected error. You can try again or go back to your projects.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-white/90"
          >
            Try again
          </button>
          <a
            href="/dashboard/projects"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/50 hover:text-white"
          >
            Back to projects
          </a>
        </div>
      </div>
    </div>
  );
}
