"use client";

import { useEffect, useState } from "react";
import { clearAuth, metricsFetch } from "@/lib/api";
import { rangeQueryParams, type DateRange } from "@/lib/date-range";

type BypassSeverity = "soft" | "hard" | "all";
type BypassThreshold = "30" | "45";
type BypassView = "projects" | "users";
type BypassSort =
  | "duration"
  | "created"
  | "credits"
  | "user"
  | "overLimitCount";

type BypassSummary = {
  totalProjects: number;
  softCount: number;
  hardCount: number;
  uniqueUsers: number;
  overLegacyMins: number;
  overCurrentCredits: number;
  overLegacyCredits: number;
  maxDurationMins: number;
  avgDurationMins: number;
  totalEstimatedCredits: number;
  byStatus: Record<string, number>;
};

type BypassProjectRow = {
  projectId: string;
  jobId?: string;
  title: string;
  name?: string;
  sourceUrl?: string;
  status: string;
  totalClips: number;
  videoDurationSecs: number;
  videoDurationMins: number;
  estimatedCredits: number;
  severity: "soft" | "hard";
  exceedsCurrentLimit: boolean;
  exceedsLegacyLimit: boolean;
  exceedsCurrentCredits: boolean;
  exceedsLegacyCredits: boolean;
  createdAt: string | null;
  error?: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  plan: string;
  subscriptionStatus: string;
  lifetimeSpent: number;
  totalCredits: number;
  topupCredits: number;
};

type BypassUserRow = {
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  plan: string;
  subscriptionStatus: string;
  lifetimeSpent: number;
  totalCredits: number;
  topupCredits: number;
  overLimitCount: number;
  hardBypassCount: number;
  softBypassCount: number;
  maxDurationMins: number;
  totalEstimatedCredits: number;
  longestSourceUrl?: string;
  lastBypassAt: string | null;
};

type BypassPayload = {
  generatedAt: string;
  limits: {
    currentMaxMins: number;
    legacyMaxMins: number;
    currentCredits: number;
    legacyCredits: number;
    creditsPerMin: number;
  };
  view: BypassView;
  threshold: BypassThreshold;
  severity: BypassSeverity;
  sort: BypassSort;
  q?: string;
  page: number;
  limit: number;
  totalPages: number;
  totalInView: number;
  summary: BypassSummary;
  projects: BypassProjectRow[];
  users: BypassUserRow[];
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMins(mins: number) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  }
  return `${mins} min`;
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-300"
      : tone === "warn"
        ? "text-amber-200"
        : "text-white";
  return (
    <div className="rounded-2xl border border-white/8 bg-[#141414] p-4">
      <p className="text-[12px] tracking-wider text-white/40 uppercase">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-white/40">{sub}</p>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "soft" | "hard" }) {
  if (severity === "hard") {
    return (
      <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200">
        &gt;45 min
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100">
      30–45 min
    </span>
  );
}

function FlagChips({ p }: { p: BypassProjectRow }) {
  const flags: string[] = [];
  if (p.exceedsLegacyLimit) flags.push(">45m");
  else if (p.exceedsCurrentLimit) flags.push(">30m");
  if (p.exceedsLegacyCredits) flags.push(">250 cr");
  else if (p.exceedsCurrentCredits) flags.push(">150 cr");
  if (flags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50"
        >
          {f}
        </span>
      ))}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-[12px] text-white/40">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/60 disabled:opacity-40 hover:bg-white/10"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/60 disabled:opacity-40 hover:bg-white/10"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function truncateUrl(url: string, max = 56) {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export function BypassPanel({
  onAuthError,
  range,
}: {
  onAuthError: () => void;
  range: DateRange;
}) {
  const [view, setView] = useState<BypassView>("projects");
  const [threshold, setThreshold] = useState<BypassThreshold>("30");
  const [severity, setSeverity] = useState<BypassSeverity>("all");
  const [sort, setSort] = useState<BypassSort>("duration");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BypassPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [range.preset, range.from, range.to]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
          view,
          threshold,
          severity,
          sort,
          fresh: page === 1 ? "1" : "0",
        });
        const rq = new URLSearchParams(rangeQueryParams(range));
        rq.forEach((v, k) => params.set(k, v));
        if (debouncedQ) params.set("q", debouncedQ);
        const res = await metricsFetch<BypassPayload>(`/bypass?${params}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load bypass report"
        );
        if (err instanceof Error && err.message === "Unauthorized") {
          clearAuth();
          onAuthError();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, threshold, severity, sort, debouncedQ, page, range.preset, range.from, range.to]);

  async function copyText(key: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  const limits = data?.limits;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm text-white/45">
          Free-plan projects that exceed video length limits. Current free:{" "}
          <span className="text-white/70">
            {limits?.currentMaxMins ?? 30} min / {limits?.currentCredits ?? 150}{" "}
            credits
          </span>
          . Previous free:{" "}
          <span className="text-white/70">
            {limits?.legacyMaxMins ?? 45} min / {limits?.legacyCredits ?? 250}{" "}
            credits
          </span>
          . Soft = over current 30m but ≤45m; hard = over the old 45m ceiling.
        </p>
        <p className="text-[12px] text-white/35">
          Duration comes from the worker after download. API length checks can be
          skipped when the client omits{" "}
          <span className="font-mono text-white/50">durationSecs</span>.
        </p>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Over-limit projects"
            value={summary.totalProjects}
            sub={`${summary.uniqueUsers} free users`}
            tone={summary.totalProjects > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Soft (30–45 min)"
            value={summary.softCount}
            sub="Bypass current free only"
            tone="warn"
          />
          <StatCard
            label="Hard (>45 min)"
            value={summary.hardCount}
            sub="Past legacy free ceiling"
            tone={summary.hardCount > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Longest video"
            value={fmtMins(summary.maxDurationMins)}
            sub={`avg ${fmtMins(summary.avgDurationMins)} · ~${summary.totalEstimatedCredits} cr`}
          />
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Cost >150 credits"
            value={summary.overCurrentCredits}
            sub="Single job above current free allotment"
          />
          <StatCard
            label="Cost >250 credits"
            value={summary.overLegacyCredits}
            sub="Single job above previous free allotment"
          />
          <StatCard
            label="Over legacy 45 min"
            value={summary.overLegacyMins}
            sub="Same as hard bypass count"
          />
        </div>
      )}

      {summary && Object.keys(summary.byStatus).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byStatus).map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70"
            >
              {k}
              <span className="ml-1.5 font-mono text-white/40 tabular-nums">
                {v}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "projects" as const, label: "Projects" },
              { id: "users" as const, label: "Users" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setView(opt.id);
                setPage(1);
                setSort(opt.id === "users" ? "overLimitCount" : "duration");
              }}
              className={`rounded-full border px-3 py-1.5 text-[12px] ${
                view === opt.id
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/55"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-[12px] text-white/40">Min length</span>
            <select
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value as BypassThreshold);
                setPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              <option value="30">&gt;30 min (current)</option>
              <option value="45">&gt;45 min (legacy)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-[12px] text-white/40">Severity</span>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value as BypassSeverity);
                setPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              <option value="all">All</option>
              <option value="soft">Soft (30–45)</option>
              <option value="hard">Hard (&gt;45)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-[12px] text-white/40">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as BypassSort);
                setPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              {view === "users" ? (
                <>
                  <option value="overLimitCount">Bypass count</option>
                  <option value="duration">Longest video</option>
                  <option value="credits">Credits</option>
                  <option value="created">Most recent</option>
                  <option value="user">Name</option>
                </>
              ) : (
                <>
                  <option value="duration">Duration</option>
                  <option value="credits">Credits</option>
                  <option value="created">Created</option>
                  <option value="user">User</option>
                </>
              )}
            </select>
          </label>

          <label className="relative block min-w-[200px] flex-1">
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search URL, email, title…"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/70">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="text-white/45">Scanning free-plan overages…</p>
      ) : view === "users" ? (
        <>
          <div className="flex items-center justify-between gap-2 text-[12px] text-white/40">
            <span>
              {data?.totalInView ?? 0} free user
              {(data?.totalInView ?? 0) === 1 ? "" : "s"} with over-limit
              projects
            </span>
            {loading && <span>Updating…</span>}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-[#111] text-left text-[12px] text-white/40 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Bypasses</th>
                  <th className="px-4 py-3 font-medium">Longest</th>
                  <th className="px-4 py-3 font-medium">Est. credits</th>
                  <th className="px-4 py-3 font-medium">Balance / spent</th>
                  <th className="px-4 py-3 font-medium">Longest link</th>
                  <th className="px-4 py-3 font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((u) => {
                  const email = u.email || u.username || "";
                  return (
                    <tr
                      key={u.userId}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="font-mono text-[10px] text-white/30">
                          {u.userId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {email ? (
                          <button
                            type="button"
                            title="Copy email"
                            onClick={() => copyText(`e-${u.userId}`, email)}
                            className="max-w-[200px] truncate text-left text-[12px] text-white/60 underline-offset-2 hover:text-white hover:underline"
                          >
                            {copied === `e-${u.userId}` ? "Copied!" : email}
                          </button>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-white tabular-nums">
                          {u.overLimitCount}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.hardBypassCount > 0 && (
                            <span className="rounded border border-red-400/25 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-200">
                              {u.hardBypassCount} hard
                            </span>
                          )}
                          {u.softBypassCount > 0 && (
                            <span className="rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-100">
                              {u.softBypassCount} soft
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-white tabular-nums">
                        {fmtMins(u.maxDurationMins)}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/80 tabular-nums">
                        {u.totalEstimatedCredits}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-white/45 tabular-nums">
                        {u.totalCredits} bal
                        {u.topupCredits > 0 && (
                          <span className="text-white/30">
                            {" "}
                            · {u.topupCredits} topup
                          </span>
                        )}
                        <div>{u.lifetimeSpent} spent</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.longestSourceUrl ? (
                          <a
                            href={u.longestSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-[240px] truncate text-[12px] text-sky-300/80 hover:text-sky-200 hover:underline"
                            title={u.longestSourceUrl}
                          >
                            {truncateUrl(u.longestSourceUrl)}
                          </a>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-white/40">
                        {fmtDate(u.lastBypassAt)}
                      </td>
                    </tr>
                  );
                })}
                {(data?.users ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-white/40"
                    >
                      No free users exceeding these limits
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[12px] text-white/40">
            <span>
              {data?.totalInView ?? 0} project
              {(data?.totalInView ?? 0) === 1 ? "" : "s"}
              {debouncedQ ? ` matching “${debouncedQ}”` : ""}
            </span>
            {loading && <span>Updating…</span>}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-[#111] text-left text-[12px] text-white/40 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Project / link</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {(data?.projects ?? []).map((p) => {
                  const email = p.email || p.username || "";
                  const label = p.name || p.title;
                  return (
                    <tr
                      key={p.projectId}
                      className="border-b border-white/[0.04] align-top hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <SeverityBadge severity={p.severity} />
                        <FlagChips p={p} />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            p.severity === "hard"
                              ? "text-red-300"
                              : "text-amber-200"
                          }`}
                        >
                          {fmtMins(p.videoDurationMins)}
                        </div>
                        <div className="font-mono text-[10px] text-white/30">
                          {p.videoDurationSecs}s
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[280px] font-medium text-white">
                          {label}
                        </div>
                        {p.sourceUrl ? (
                          <div className="mt-1 flex items-center gap-2">
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[240px] truncate text-[12px] text-sky-300/80 hover:text-sky-200 hover:underline"
                              title={p.sourceUrl}
                            >
                              {truncateUrl(p.sourceUrl)}
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(`u-${p.projectId}`, p.sourceUrl!)
                              }
                              className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 hover:text-white"
                            >
                              {copied === `u-${p.projectId}` ? "OK" : "Copy"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-white/30">
                            No source URL
                          </span>
                        )}
                        <div className="mt-1 font-mono text-[10px] text-white/25">
                          {p.projectId}
                          {p.totalClips > 0 && ` · ${p.totalClips} clips`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {p.firstName} {p.lastName}
                        </div>
                        {email ? (
                          <button
                            type="button"
                            title="Copy email"
                            onClick={() => copyText(`e-${p.projectId}`, email)}
                            className="max-w-[180px] truncate text-left text-[12px] text-white/55 underline-offset-2 hover:text-white hover:underline"
                          >
                            {copied === `e-${p.projectId}` ? "Copied!" : email}
                          </button>
                        ) : (
                          <span className="text-[12px] text-white/30">—</span>
                        )}
                        <div className="mt-0.5 text-[11px] text-white/35">
                          free
                          {p.topupCredits > 0 && (
                            <span> · {p.topupCredits} topup cr</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] capitalize text-white/65">
                          {p.status}
                        </span>
                        {p.error && (
                          <p
                            className="mt-1 max-w-[140px] truncate text-[10px] text-red-300/70"
                            title={p.error}
                          >
                            {p.error}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        <div
                          className={
                            p.exceedsCurrentCredits
                              ? "text-amber-200"
                              : "text-white/80"
                          }
                        >
                          {p.estimatedCredits}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {p.lifetimeSpent} life spent
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-white/40">
                        {fmtDate(p.createdAt)}
                      </td>
                    </tr>
                  );
                })}
                {(data?.projects ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-white/40"
                    >
                      No free-plan projects over this threshold
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && (
        <Pager
          page={data.page}
          totalPages={data.totalPages}
          total={data.totalInView}
          onChange={setPage}
          disabled={loading}
        />
      )}
    </div>
  );
}
