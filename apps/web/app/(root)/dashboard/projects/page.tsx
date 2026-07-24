"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiFetch } from "@/lib/apiFetch";
import { Loader2, Film, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Sidebar from "../_components/sidebar";
import Topbar from "../_components/topbar";
import posthog from "posthog-js";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PLATFORM_STYLES: { match: (url: string) => boolean; name: string; color: string; icon: React.ReactNode }[] = [
  {
    match: (u) => u.includes("instagram.com"),
    name: "Instagram", color: "#E1306C",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  },
  {
    match: (u) => u.includes("x.com") || u.includes("twitter.com"),
    name: "X / Twitter", color: "#e5e5e5",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    match: (u) => u.includes("tiktok.com"),
    name: "TikTok", color: "#69C9D0",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.27 8.27 0 004.84 1.55V7a4.85 4.85 0 01-1.07-.31z"/></svg>,
  },
  {
    match: (u) => u.includes("twitch.tv"),
    name: "Twitch", color: "#9146FF",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>,
  },
  {
    match: (u) => u.includes("facebook.com") || u.includes("fb.watch"),
    name: "Facebook", color: "#1877F2",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    match: (u) => u.includes("vimeo.com"),
    name: "Vimeo", color: "#1AB7EA",
    icon: <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.612-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.478 4.807z"/></svg>,
  },
];

function getPlatformStyle(url?: string) {
  if (!url) return null;
  return PLATFORM_STYLES.find(p => p.match(url)) ?? null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: "Queued",     color: "text-white/40",  icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Processing", color: "text-blue-400",  icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  done:       { label: "Done",       color: "text-white/70",  icon: <CheckCircle className="h-3 w-3" /> },
  failed:     { label: "Failed",     color: "text-red-400",   icon: <XCircle className="h-3 w-3" /> },
};

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const apiFetch = useApiFetch();

  const fetchProjects = async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/projects`);
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleDeleteClick = (e: React.MouseEvent, projectId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id: projectId, title });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`${API_URL}/api/projects/${deleteTarget.id}`, { method: "DELETE" });
      posthog.capture("project_deleted", { project_id: deleteTarget.id });
      setProjects((p) => p.filter((x) => x._id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="md:ml-14 mt-0 md:mt-12 flex-1 px-6 py-10 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[18px] font-semibold text-white">Projects</h1>
              <p className="text-[13px] text-white/35 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors"
            >
              + New project
            </Link>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-white/30 py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">Loading projects…</span>
            </div>
          )}

          {/* Empty */}
          {!loading && projects.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-[#141414]">
                <Film className="h-6 w-6 text-white/20" />
              </div>
              <p className="text-[14px] text-white/35">No projects yet.</p>
              <Link href="/dashboard" className="text-[13px] text-white/60 underline underline-offset-2 hover:text-white transition-colors">
                Create your first project →
              </Link>
            </div>
          )}

          {/* Grid */}
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.pending!;
                return (
                  <Link
                    key={project._id}
                    href={`/dashboard/projects/${project._id}`}
                    className="group relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#111] p-4 hover:border-white/16 transition-all"
                  >
                    {/* Thumbnail */}
                    {(() => {
                      const platform = getPlatformStyle(project.sourceUrl);
                      return (
                        <div className="aspect-video w-full rounded-xl bg-[#1a1a1a] flex items-center justify-center overflow-hidden border border-white/6">
                          {project.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : platform ? (
                            <div
                              className="w-full h-full flex flex-col items-center justify-center gap-2"
                              style={{ background: `radial-gradient(ellipse at center, ${platform.color}20 0%, #1a1a1a 70%)` }}
                            >
                              <span style={{ color: platform.color }} className="opacity-70">{platform.icon}</span>
                              <span className="text-[10px] text-white/25">{platform.name}</span>
                            </div>
                          ) : (
                            <Film className="h-8 w-8 text-white/10" />
                          )}
                        </div>
                      );
                    })()}

                    {/* Info */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[14px] font-medium text-white/90 line-clamp-1 leading-snug">
                        {project.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status */}
                        <span className={`flex items-center gap-1 text-[11px] ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                        {/* Clips count */}
                        {project.totalClips > 0 && (
                          <span className="text-[11px] text-white/30">
                            · {project.totalClips} clip{project.totalClips !== 1 ? "s" : ""}
                          </span>
                        )}
                        {/* Duration */}
                        {project.videoDuration && (
                          <span className="text-[11px] text-white/25">
                            · {formatDuration(project.videoDuration)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/20">{timeAgo(project.createdAt)}</p>
                    </div>

                    {/* Delete button */}
                    {(() => {
                      const isProcessing = !["done", "failed"].includes(project.status);
                      return (
                        <button
                          onClick={(e) => !isProcessing && handleDeleteClick(e, project._id, project.title)}
                          disabled={isProcessing}
                          title={isProcessing ? "Wait until processing completes" : "Delete project"}
                          className={`absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-all
                            ${isProcessing
                              ? "text-white/15 cursor-not-allowed"
                              : "text-white/20 hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
                            }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      );
                    })()}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold text-white">Delete project?</h2>
              <p className="text-[13px] text-white/45 leading-snug">
                <span className="text-white/70 font-medium">&ldquo;{deleteTarget.title}&rdquo;</span> and all its clips will be permanently deleted from storage. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="cursor-pointer px-4 py-2 rounded-xl text-[13px] text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:border-red-500/40 transition-colors disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
