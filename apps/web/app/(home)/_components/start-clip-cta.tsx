"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { URL_PLACEHOLDERS, validateVideoUrl } from "@/lib/url-placeholders";

type Props = {
  primaryLabel?: string;
};

export default function StartClipCta({ primaryLabel = "Get free clips" }: Props) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleUploadClick = () => {
    if (isSignedIn) {
      router.push("/dashboard?upload=1");
    } else {
      router.push("/sign-up?redirect_url=/dashboard?upload=1");
    }
  };

  const goToDashboard = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();

    if (trimmed) {
      const validation = validateVideoUrl(trimmed);
      if (!validation.valid) {
        setUrlError(validation.error ?? "Please enter a valid video URL.");
        return;
      }
      setUrlError(null);
    }

    const destination = trimmed
      ? `/dashboard?url=${encodeURIComponent(trimmed)}`
      : "/dashboard";

    if (isSignedIn) {
      router.push(destination);
    } else {
      const signUpUrl = trimmed
        ? `/sign-up?redirect_url=${encodeURIComponent(destination)}`
        : "/sign-up";
      router.push(signUpUrl);
    }
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={cn(
            "flex min-h-[48px] h-12 w-full min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-3.5 sm:px-4 transition-all duration-200",
            "border-white/12 bg-white/[0.07] focus-within:border-white/30 focus-within:bg-white/10",
            urlError && "border-red-500/40",
          )}
        >
          <Link2 className="h-4 w-4 shrink-0 text-white/45" />
          <div className="min-w-0 flex-1 h-full">
            <PlaceholdersAndVanishInput
              inline
              placeholders={URL_PLACEHOLDERS}
              value={url}
              onValueChange={(v) => {
                setUrl(v);
                if (urlError) setUrlError(null);
              }}
              onSubmit={(e) => goToDashboard(e)}
              hideSubmitButton
            />
          </div>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => goToDashboard()}
            className="cursor-pointer flex-1 sm:flex-none rounded-2xl bg-white px-4 py-2.5 sm:px-5 sm:py-3.5 text-[13px] sm:text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-95 whitespace-nowrap"
          >
            {primaryLabel}
          </button>
          <span className="text-[12px] sm:text-[13px] text-white/40 shrink-0">or</span>
          <button
            type="button"
            onClick={handleUploadClick}
            className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-2.5 sm:px-5 sm:py-3.5 text-[13px] sm:text-[14px] font-medium text-white/55 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80 active:scale-95 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Upload files
          </button>
        </div>
      </div>
      {urlError && (
        <p className="text-[12px] text-red-400/90 px-1">{urlError}</p>
      )}
      <p className="text-[12.5px] text-white/45">
        YouTube, X, Drive, Loom, or Instagram · No credit card required
      </p>
    </div>
  );
}
