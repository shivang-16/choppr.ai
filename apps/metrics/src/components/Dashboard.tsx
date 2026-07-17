"use client";

import { useEffect, useState } from "react";
import { clearAuth, metricsFetch } from "@/lib/api";
import { SEGMENT_ORDER, type SalesSegmentId } from "@/lib/segment-meta";

type Overview = {
  generatedAt: string;
  users: {
    total: number;
    last7d: number;
    last30d: number;
    onboarded: number;
    bySubscription: Record<string, number>;
    byPlan: Record<string, number>;
  };
  projects: {
    total: number;
    last7d: number;
    last30d: number;
    byStatus: Record<string, number>;
  };
  clips: { total: number; last7d: number };
  exports: {
    total: number;
    last7d: number;
    done: number;
    byStatus: Record<string, number>;
  };
  credits: {
    topupGrants: number;
    topupCreditsGranted: number;
    creditsSpent: number;
  };
};

type UserRow = {
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  subscriptionStatus: string;
  plan: string;
  projectCount: number;
  projectsByStatus: {
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
  clipCount: number;
  exportCount: number;
  exportDoneCount: number;
  lastVisitedAt: string | null;
  visitCount: number;
  lifetimeSpent: number;
  signedUpAt?: string;
  totalCredits?: number;
  topupCount?: number;
};

type Leaderboards = {
  topByProjects: UserRow[];
  topByClips: UserRow[];
  topByExports: UserRow[];
  recentlyActive: UserRow[];
};

type SalesLead = UserRow & {
  segment: SalesSegmentId;
  priority: number;
  label: string;
  reason: string;
  suggestedMessage: string;
};

type SalesPayload = {
  totalLeads: number;
  filteredTotal: number;
  summary: Record<SalesSegmentId, number>;
  page: number;
  limit: number;
  totalPages: number;
  segment: SalesSegmentId | "all";
  leads: SalesLead[];
};

type SnapshotPayload = {
  overview: Overview;
  totalUsers: number;
  leaderboards: Leaderboards;
  sales: SalesPayload;
};

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

type Tab =
  | "overview"
  | "sales"
  | "active"
  | "projects"
  | "clips"
  | "exports";

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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#141414] p-4">
      <p className="text-[12px] tracking-wider text-white/40 uppercase">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] text-white/40">{sub}</p>}
    </div>
  );
}

function StatusChips({ map }: { map: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(map).map(([k, v]) => (
        <span
          key={k}
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70"
        >
          {k}
          <span className="ml-1.5 font-mono text-white/40 tabular-nums">{v}</span>
        </span>
      ))}
    </div>
  );
}

function UserTable({
  rows,
  mode,
}: {
  rows: UserRow[];
  mode: "active" | "projects" | "clips" | "exports";
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-white/8 bg-[#111] text-left text-[12px] tracking-wider text-white/40 uppercase">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Plan</th>
            {mode === "active" && (
              <>
                <th className="px-4 py-3 font-medium">Last visited</th>
                <th className="px-4 py-3 font-medium">Visits</th>
              </>
            )}
            <th className="px-4 py-3 font-medium">Projects</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Clips</th>
            <th className="px-4 py-3 font-medium">Exports</th>
            <th className="px-4 py-3 font-medium">Credits spent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.userId}
              className="border-b border-white/[0.04] hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-white">
                  {u.firstName} {u.lastName}
                </div>
                <div className="text-[12px] text-white/40">{u.email || u.username}</div>
              </td>
              <td className="px-4 py-3 capitalize text-white/50">
                {u.plan}
                <span className="ml-1 text-[10px] text-white/30">
                  ({u.subscriptionStatus})
                </span>
              </td>
              {mode === "active" && (
                <>
                  <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-white/45">
                    {fmtDate(u.lastVisitedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">
                    {u.visitCount}
                  </td>
                </>
              )}
              <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">
                {u.projectCount}
              </td>
              <td className="px-4 py-3">
                <span className="text-[12px] text-white/40">
                  ✓{u.projectsByStatus.done} · …{u.projectsByStatus.processing} · ✕
                  {u.projectsByStatus.failed}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-white/80 tabular-nums">
                {u.clipCount}
              </td>
              <td className="px-4 py-3 font-mono text-white/80 tabular-nums">
                {u.exportDoneCount}
                <span className="text-white/30">/{u.exportCount}</span>
              </td>
              <td className="px-4 py-3 font-mono text-white/40 tabular-nums">
                {u.lifetimeSpent}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-white/40">
                No data yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SalesPanel({
  sales,
  onPageChange,
  onSegmentChange,
  paging,
}: {
  sales: SalesPayload;
  onPageChange: (page: number) => void;
  onSegmentChange: (segment: SalesSegmentId | "all") => void;
  paging: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyMsg(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-white/45">
        Who to message and what to say — based on usage. One primary segment per
        user. Paginated (25 per page).
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENT_ORDER.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              onSegmentChange(sales.segment === s.id ? "all" : s.id)
            }
            className={`rounded-2xl border p-4 text-left transition ${
              sales.segment === s.id
                ? "border-white/20 bg-white/10"
                : "border-white/8 bg-[#141414] hover:bg-white/[0.04]"
            }`}
          >
            <p className="text-[12px] text-white/40">{s.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
              {sales.summary[s.id] ?? 0}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSegmentChange("all")}
          className={`rounded-full border px-3 py-1.5 text-[12px] ${
            sales.segment === "all"
              ? "border-white/20 bg-white text-black"
              : "border-white/10 bg-white/5 text-white/55"
          }`}
        >
          All leads ({sales.totalLeads})
        </button>
        {SEGMENT_ORDER.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSegmentChange(s.id)}
            className={`rounded-full border px-3 py-1.5 text-[12px] ${
              sales.segment === s.id
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-white/5 text-white/55"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {paging && (
          <p className="text-[12px] text-white/40">Loading page…</p>
        )}
        {sales.leads.map((lead) => (
          <div
            key={`${lead.segment}-${lead.userId}`}
            className="rounded-2xl border border-white/8 bg-[#141414] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                    {lead.label}
                  </span>
                  <span className="text-[12px] capitalize text-white/35">
                    {lead.plan}
                  </span>
                </div>
                <p className="mt-2 font-medium tracking-tight text-white">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="text-[12px] text-white/40">
                  {lead.email || lead.username}
                </p>
                <p className="mt-1 text-[12px] text-white/50">{lead.reason}</p>
              </div>
              <div className="text-right font-mono text-[12px] text-white/35">
                <div>{lead.projectCount} projects</div>
                <div>{lead.exportDoneCount} exports</div>
                <div>{lead.lifetimeSpent} spent</div>
                <div className="mt-1">{fmtDate(lead.lastVisitedAt)}</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/6 bg-[#080808] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] tracking-wider text-white/35 uppercase">
                  Suggested message
                </p>
                <button
                  type="button"
                  onClick={() =>
                    copyMsg(lead.userId + lead.segment, lead.suggestedMessage)
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {copied === lead.userId + lead.segment ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-white/75">
                {lead.suggestedMessage}
              </p>
            </div>
          </div>
        ))}
        {sales.leads.length === 0 && !paging && (
          <p className="py-10 text-center text-white/40">No leads in this segment</p>
        )}
      </div>

      <Pager
        page={sales.page}
        totalPages={sales.totalPages}
        total={sales.filteredTotal}
        onChange={onPageChange}
        disabled={paging}
      />
    </div>
  );
}

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [sales, setSales] = useState<SalesPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [salesPaging, setSalesPaging] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const snap = await metricsFetch<SnapshotPayload>("/snapshot?fresh=1");
      setOverview(snap.overview);
      setLeaderboards(snap.leaderboards);
      setSales(snap.sales);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      if (err instanceof Error && err.message === "Unauthorized") {
        clearAuth();
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSalesPage(
    page: number,
    segment: SalesSegmentId | "all" = sales?.segment ?? "all"
  ) {
    setSalesPaging(true);
    setError("");
    try {
      const data = await metricsFetch<SalesPayload>(
        `/sales?page=${page}&limit=25&segment=${segment}`
      );
      setSales(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
      if (err instanceof Error && err.message === "Unauthorized") {
        clearAuth();
        onLogout();
      }
    } finally {
      setSalesPaging(false);
    }
  }

  // Load once on open / page reload — no polling.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, []);

  function handleLogout() {
    clearAuth();
    onLogout();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "sales", label: "Who to message" },
    { id: "active", label: "Recently active" },
    { id: "projects", label: "Top projects" },
    { id: "clips", label: "Top clips" },
    { id: "exports", label: "Top exports" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium tracking-[0.2em] text-white/40 uppercase">
            Choppr
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
            Metrics
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Marketing & sales ·{" "}
            {overview
              ? `Updated ${fmtDate(overview.generatedAt)}`
              : loading
                ? "Loading…"
                : "Ready"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-white/12 bg-white/6 px-4 py-2 text-sm text-white/55 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-white/8 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === t.id
                ? "border-white text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mb-4 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/70">
          {error}
        </p>
      )}

      {loading && !overview ? (
        <p className="text-white/45">Loading metrics…</p>
      ) : !overview ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#141414] px-6 py-16 text-center">
          <p className="text-white/45">
            Couldn’t load metrics. Click <span className="text-white">Refresh</span> to
            try again.
          </p>
        </div>
      ) : (
        <>
          {tab === "overview" && overview && (
            <div className="space-y-8">
              <section>
                <h2 className="mb-3 text-[12px] font-medium tracking-wider text-white/40 uppercase">
                  Users
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Total users" value={overview.users.total} />
                  <StatCard label="New (7d)" value={overview.users.last7d} />
                  <StatCard label="New (30d)" value={overview.users.last30d} />
                  <StatCard
                    label="Onboarded"
                    value={overview.users.onboarded}
                    sub={`${overview.users.total ? Math.round((overview.users.onboarded / overview.users.total) * 100) : 0}% of total`}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-[12px] text-white/40">By subscription</p>
                  <StatusChips map={overview.users.bySubscription} />
                  <p className="pt-2 text-[12px] text-white/40">By plan</p>
                  <StatusChips map={overview.users.byPlan} />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-[12px] font-medium tracking-wider text-white/40 uppercase">
                  Product activity
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Projects"
                    value={overview.projects.total}
                    sub={`+${overview.projects.last7d} this week`}
                  />
                  <StatCard
                    label="Clips"
                    value={overview.clips.total}
                    sub={`+${overview.clips.last7d} this week`}
                  />
                  <StatCard
                    label="Exports (done)"
                    value={overview.exports.done}
                    sub={`${overview.exports.total} total · +${overview.exports.last7d} week`}
                  />
                  <StatCard
                    label="Credits spent"
                    value={overview.credits.creditsSpent}
                    sub={`${overview.credits.topupGrants} top-ups · ${overview.credits.topupCreditsGranted} credits bought`}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-[12px] text-white/40">Projects by status</p>
                  <StatusChips map={overview.projects.byStatus} />
                  <p className="pt-2 text-[12px] text-white/40">Exports by status</p>
                  <StatusChips map={overview.exports.byStatus} />
                </div>
              </section>

              {sales && (
                <section>
                  <h2 className="mb-3 text-[12px] font-medium tracking-wider text-white/40 uppercase">
                    Outreach queue
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                      label="Total leads"
                      value={sales.totalLeads}
                      sub="Open Who to message for copy-ready texts"
                    />
                    <StatCard
                      label="Upgrade ready"
                      value={sales.summary.upgrade_ready ?? 0}
                    />
                    <StatCard
                      label="Churn risk"
                      value={sales.summary.churn_risk ?? 0}
                    />
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === "sales" && sales && (
            <SalesPanel
              sales={sales}
              paging={salesPaging}
              onPageChange={(page) => loadSalesPage(page)}
              onSegmentChange={(segment) => loadSalesPage(1, segment)}
            />
          )}

          {tab === "active" && leaderboards && (
            <div>
              <p className="mb-3 text-sm text-white/45">
                Top 50 recently active. Last visited = max(last project, last
                export).
              </p>
              <UserTable rows={leaderboards.recentlyActive} mode="active" />
            </div>
          )}

          {tab === "projects" && leaderboards && (
            <div>
              <p className="mb-3 text-sm text-white/45">Top 50 by project count</p>
              <UserTable rows={leaderboards.topByProjects} mode="projects" />
            </div>
          )}
          {tab === "clips" && leaderboards && (
            <div>
              <p className="mb-3 text-sm text-white/45">Top 50 by clip count</p>
              <UserTable rows={leaderboards.topByClips} mode="clips" />
            </div>
          )}
          {tab === "exports" && leaderboards && (
            <div>
              <p className="mb-3 text-sm text-white/45">Top 50 by exports done</p>
              <UserTable rows={leaderboards.topByExports} mode="exports" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
