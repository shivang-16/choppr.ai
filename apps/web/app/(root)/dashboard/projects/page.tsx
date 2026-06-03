"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Film, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Sidebar from "../_components/sidebar";
import Topbar from "../_components/topbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, { credentials: "include" });
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project and all its clips?")) return;
    await fetch(`${API_URL}/api/projects/${projectId}`, { method: "DELETE", credentials: "include" });
    setProjects((p) => p.filter((x) => x._id !== projectId));
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="ml-14 mt-12 flex-1 px-6 py-10">
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
                    {/* Thumbnail placeholder */}
                    <div className="aspect-video w-full rounded-xl bg-[#1a1a1a] flex items-center justify-center overflow-hidden border border-white/6">
                      {project.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Film className="h-8 w-8 text-white/10" />
                      )}
                    </div>

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
                    <button
                      onClick={(e) => handleDelete(e, project._id)}
                      className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg bg-black/40 text-white/20 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
