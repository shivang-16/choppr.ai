"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiFetch = (input: string, init?: RequestInit) => Promise<Response>;

type Channel = { _id: string; channelTitle: string; status: string };

export function YoutubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5" fill="#111" />
      <path d="M9.6 7.8v8.4l6.8-4.2-6.8-4.2z" fill="#fff" />
    </svg>
  );
}

export function PublishYoutubeDialog({
  open,
  onClose,
  apiFetch,
  clipId,
  exportId,
}: {
  open: boolean;
  onClose: () => void;
  apiFetch: ApiFetch;
  clipId?: string;
  exportId?: string;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "schedule">("public");
  const [scheduleAt, setScheduleAt] = useState("");
  const [madeForKids, setMadeForKids] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setNeedsReconnect(false);
    setPublishedUrl("");
    setLoadingChannels(true);
    apiFetch(`${API_URL}/api/youtube`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = ((data?.connections ?? []) as Channel[]).filter((channel) => channel.status === "active");
        setChannels(list);
        setConnectionId((current) => current || list[0]?._id || "");
      })
      .catch(() => setError("Could not load your YouTube channels"))
      .finally(() => setLoadingChannels(false));
  }, [open, apiFetch]);

  if (!open) return null;

  const connect = async () => {
    const res = await apiFetch(`${API_URL}/api/youtube/connect`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.href = data.url;
    else setError(data.message || "Could not start YouTube connect");
  };

  const publish = async () => {
    setError("");
    setNeedsReconnect(false);
    if (!title.trim()) {
      setError("Add a title");
      return;
    }
    if (!connectionId) {
      setError("Connect a YouTube channel first");
      return;
    }
    let publishAt: string | undefined;
    if (visibility === "schedule") {
      const when = new Date(scheduleAt);
      if (!scheduleAt || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) {
        setError("Pick a schedule time at least a minute from now");
        return;
      }
      publishAt = when.toISOString();
    }
    setPosting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/youtube/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          title: title.trim(),
          description: description.trim(),
          privacy: visibility === "private" ? "private" : "public",
          ...(publishAt ? { publishAt } : {}),
          madeForKids,
          ...(clipId ? { clipId } : {}),
          ...(exportId ? { exportId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.message || "Could not publish";
        setError(message);
        setNeedsReconnect(/reconnect/i.test(message));
        return;
      }
      setPublishedUrl(data.url || `https://www.youtube.com/shorts/${data.videoId}`);
    } catch {
      setError("Could not publish");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90svh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[16px] font-semibold text-white inline-flex items-center gap-2">
            <YoutubeMark className="h-5 w-5" /> Publish to YouTube
          </h2>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {publishedUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-white">Published.</p>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] text-white underline">
              Open on YouTube
            </a>
            <button type="button" onClick={onClose} className="rounded-2xl bg-white py-3 text-[14px] font-semibold text-black cursor-pointer">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {loadingChannels ? (
              <p className="text-[13px] text-white/50 inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading channels</p>
            ) : channels.length === 0 ? (
              <button type="button" onClick={connect} className="rounded-2xl bg-white py-3 text-[14px] font-semibold text-black cursor-pointer">
                Connect your YouTube channel
              </button>
            ) : channels.length > 1 ? (
              <label className="flex flex-col gap-1 text-[12px] text-white/60">
                Channel
                <select
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                  className="rounded-xl border border-white/10 bg-black px-3 py-2 text-[14px] text-white"
                >
                  {channels.map((channel) => (
                    <option key={channel._id} value={channel._id}>{channel.channelTitle}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-[13px] text-white/70">{channels[0]?.channelTitle}</p>
            )}

            <label className="flex flex-col gap-1 text-[12px] text-white/60">
              Title
              <input
                value={title}
                maxLength={100}
                placeholder="Give this Short a title"
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-white/60">
              Description
              <textarea
                value={description}
                maxLength={5000}
                rows={4}
                placeholder="What is this Short about?"
                onChange={(event) => setDescription(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white outline-none resize-none placeholder:text-white/30"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(["public", "private", "schedule"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  className={`rounded-xl py-2 text-[13px] font-medium capitalize cursor-pointer ${
                    visibility === option ? "bg-white text-black" : "bg-white/5 text-white/70"
                  }`}
                >
                  {option === "schedule" ? "Schedule" : option}
                </button>
              ))}
            </div>
            {visibility === "schedule" && (
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white"
              />
            )}
            <label className="flex items-center gap-2 text-[13px] text-white/70 cursor-pointer">
              <input type="checkbox" checked={madeForKids} onChange={(event) => setMadeForKids(event.target.checked)} />
              Made for kids
            </label>

            {error && <p className="text-[12px] text-red-400">{error}</p>}
            {needsReconnect && (
              <button type="button" onClick={connect} className="text-[13px] text-white underline text-left cursor-pointer">
                Reconnect YouTube
              </button>
            )}

            <button
              type="button"
              onClick={publish}
              disabled={posting || channels.length === 0}
              className="rounded-2xl bg-white py-3 text-[14px] font-semibold text-black disabled:opacity-40 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <YoutubeMark className="h-4 w-4" />}
              {posting ? "Publishing" : "Publish"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
