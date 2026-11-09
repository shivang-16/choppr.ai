"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Plus, Play, RefreshCw, Scissors } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useApiFetch } from "@/lib/apiFetch";
import Sidebar from "../_components/sidebar";
import Topbar from "../_components/topbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const HOUR_MS = 60 * 60 * 1000;

type Category = "all" | "video" | "short" | "live";

type Connection = {
  _id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  customUrl?: string;
  status: "active" | "needs_reconnect";
  lastSyncedAt?: string;
  lastSyncError?: string;
  videoCount: number;
};

type Video = {
  _id: string;
  connectionId: string;
  channelId: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  durationSecs: number;
  privacyStatus: string;
  category: "video" | "short" | "live";
  madeForKids: boolean;
  viewCount: number;
  projectId?: string;
  projectStatus?: "pending" | "processing" | "done" | "failed";
};

type Library = { connections: Connection[]; videos: Video[] };

const TABS: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "short", label: "Shorts" },
  { id: "live", label: "Live" },
];

function formatDuration(seconds: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

function timeAgo(date?: string) {
  if (!date) return "not synced yet";
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function dashboardVideoHref(video: Pick<Video, "videoId" | "title" | "durationSecs" | "thumbnailUrl">) {
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    duration: String(video.durationSecs || 0),
  });
  if (video.title) params.set("title", video.title.slice(0, 200));
  if (video.thumbnailUrl) params.set("thumb", video.thumbnailUrl);
  return `/dashboard?${params.toString()}`;
}

function isStale(connection: Connection) {
  if (connection.status !== "active") return false;
  if (!connection.lastSyncedAt) return true;
  return Date.now() - new Date(connection.lastSyncedAt).getTime() >= HOUR_MS;
}

export default function YoutubePage() {
  const apiFetch = useApiFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const [library, setLibrary] = useState<Library>({ connections: [], videos: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>("all");
  const [category, setCategory] = useState<Category>("all");

  const load = useCallback(async () => {
    const res = await apiFetch(`${API_URL}/api/youtube`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || "Could not load YouTube");
    }
    return await res.json() as Library;
  }, [apiFetch]);

  const refresh = useCallback(async (manual = false) => {
    setRefreshing(true);
    if (manual) {
      setError(null);
      setRefreshDone(false);
    }
    try {
      const res = await apiFetch(`${API_URL}/api/youtube/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || "Refresh failed");
      setLibrary(body as Library);
      if (manual) setRefreshDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectError = params.get("error");
    if (connectError) setError(connectError);
    if (params.get("connected")) setNotice("Channel connected");
    if (params.toString()) window.history.replaceState(null, "", "/dashboard/youtube");
  }, []);

  const hasRunningProject = library.videos.some(
    (video) => video.projectStatus === "pending" || video.projectStatus === "processing",
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !hasRunningProject) return;
    const timer = window.setInterval(() => {
      load().then(setLibrary).catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [hasRunningProject, isLoaded, isSignedIn, load]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (cancelled) return;
        setLibrary(data);
        if (data.connections.some(isStale)) void refresh();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load YouTube");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const timer = window.setInterval(() => { void refresh(); }, HOUR_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isLoaded, isSignedIn, load, refresh]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/youtube/connect`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || "Could not start YouTube connect");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start YouTube connect");
      setConnecting(false);
    }
  };

  const disconnect = async (connection: Connection) => {
    if (!window.confirm(`Remove ${connection.channelTitle}?`)) return;
    setError(null);
    const res = await apiFetch(`${API_URL}/api/youtube/connections/${connection._id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || body.message || "Could not remove channel");
      return;
    }
    setLibrary((current) => ({
      connections: current.connections.filter((item) => item._id !== connection._id),
      videos: current.videos.filter((item) => item.connectionId !== connection._id),
    }));
    if (channelId === connection._id) setChannelId("all");
  };

  const channelVideos = useMemo(
    () => channelId === "all"
      ? library.videos
      : library.videos.filter((video) => video.connectionId === channelId),
    [library.videos, channelId],
  );

  const visible = category === "all"
    ? channelVideos
    : channelVideos.filter((video) => video.category === category);

  const counts = {
    all: channelVideos.length,
    video: channelVideos.filter((video) => video.category === "video").length,
    short: channelVideos.filter((video) => video.category === "short").length,
    live: channelVideos.filter((video) => video.category === "live").length,
  };

  const newestSync = library.connections
    .map((connection) => connection.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="md:ml-14 mt-12 flex-1 px-6 py-10 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-white">YouTube</h1>
              <p className="text-[13px] text-white/35 mt-0.5">
                {library.connections.length === 0
                  ? "Connect a channel to cache its videos"
                  : `Updated ${timeAgo(newestSync)} · refreshes every hour`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {refreshDone && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-200">
                  Refresh complete
                </div>
              )}
              <div className="flex items-center gap-2">
                {library.connections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void refresh(true)}
                    disabled={refreshing}
                    aria-label="Refresh"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/8 px-2.5 py-2 text-[13px] font-medium text-white/80 hover:bg-white/12 disabled:opacity-50 sm:px-3.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={connecting}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add channel
                </button>
              </div>
            </div>
          </div>

          {notice && (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/70">{notice}</p>
          )}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">{error}</p>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : library.connections.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
              <p className="text-[15px] font-medium text-white">No channels connected</p>
              <p className="mt-1 text-[13px] text-white/40">
                Add a YouTube channel and Choppr will keep a cached list of its videos.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {library.connections.map((connection) => (
                  <div key={connection._id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    {connection.thumbnailUrl ? (
                      <Image src={connection.thumbnailUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{connection.channelTitle}</p>
                      <p className="truncate text-[12px] text-white/35">
                        {connection.customUrl ? `${connection.customUrl} · ` : ""}
                        {connection.videoCount} videos · {timeAgo(connection.lastSyncedAt)}
                        {connection.status === "needs_reconnect" ? " · reconnect required" : ""}
                      </p>
                      {connection.lastSyncError && (
                        <p className="truncate text-[12px] text-red-300/80">{connection.lastSyncError}</p>
                      )}
                    </div>
                    {connection.status === "needs_reconnect" && (
                      <button type="button" onClick={() => void connect()} className="text-[12px] text-white/70 hover:text-white">
                        Reconnect
                      </button>
                    )}
                    <button type="button" onClick={() => void disconnect(connection)} className="text-[12px] text-white/35 hover:text-white">
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {library.connections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setChannelId("all")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] ${channelId === "all" ? "bg-white text-black" : "bg-white/5 text-white/60"}`}
                  >
                    All channels
                  </button>
                )}
                {library.connections.length > 1 && library.connections.map((connection) => (
                  <button
                    key={connection._id}
                    type="button"
                    onClick={() => setChannelId(connection._id)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] ${channelId === connection._id ? "bg-white text-black" : "bg-white/5 text-white/60"}`}
                  >
                    {connection.channelTitle}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] ${category === tab.id ? "bg-white text-black" : "bg-white/5 text-white/55"}`}
                  >
                    {tab.label} {counts[tab.id]}
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-white/35">
                  {refreshing ? "Fetching videos from YouTube…" : "No videos in this category."}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((video) => {
                    const duration = formatDuration(video.durationSecs);
                    return (
                      <div
                        key={video._id}
                        className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
                      >
                        <a
                          href={`https://www.youtube.com/watch?v=${video.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="group block"
                        >
                          <div className="relative aspect-video bg-white/5">
                            {video.thumbnailUrl && (
                              <Image src={video.thumbnailUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 320px" />
                            )}
                            {duration && (
                              <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white">
                                {duration}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 px-3 py-2.5">
                            <p className="line-clamp-2 text-[13px] font-medium text-white group-hover:text-white/80">{video.title}</p>
                            <p className="text-[12px] text-white/35">
                              {formatViews(video.viewCount)}
                              {video.privacyStatus !== "public" ? ` · ${video.privacyStatus}` : ""}
                              {video.madeForKids ? " · kids" : ""}
                            </p>
                          </div>
                        </a>
                        <div className="px-3 pb-3">
                          {(video.projectStatus === "pending" || video.projectStatus === "processing") && video.projectId ? (
                            <Link
                              href={`/dashboard/projects/${video.projectId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/6 px-2 py-2 text-[12px] font-semibold text-white/70 hover:bg-white/10"
                            >
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Processing
                            </Link>
                          ) : video.projectStatus === "done" && video.projectId ? (
                            <Link
                              href={`/dashboard/projects/${video.projectId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/6 px-2 py-2 text-[12px] font-semibold text-white hover:bg-white/10"
                            >
                              <Play className="h-3.5 w-3.5" />
                              View clips
                            </Link>
                          ) : (
                            <Link
                              href={dashboardVideoHref(video)}
                              target="_blank"
                              rel="noreferrer"
                              className={video.projectId
                                ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/6 px-2 py-2 text-[12px] font-semibold text-white hover:bg-white/10"
                                : "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-2 text-[12px] font-semibold text-black hover:bg-white/90"}
                            >
                              <Scissors className="h-3.5 w-3.5" />
                              {video.projectId ? "Clip again" : "Get clips"}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
