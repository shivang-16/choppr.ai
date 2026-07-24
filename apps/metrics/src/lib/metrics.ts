import {
  User,
  Project,
  Clip,
  Export,
  UserCredits,
  CreditLedger,
} from "./models";
import {
  toSalesLead,
  type SalesLead,
  type SalesSegmentId,
  type UserMetricsRow,
} from "./sales";

const LEADERBOARD_LIMIT = 50;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const BATCH_SIZE = 250;
const CACHE_TTL_MS = 2 * 60 * 1000;

type ProjectStat = {
  projectCount: number;
  lastProjectAt: Date | null;
  statusPending: number;
  statusProcessing: number;
  statusDone: number;
  statusFailed: number;
};

type ClipStat = { clipCount: number; lastClipAt: Date | null };
type ExportStat = {
  exportCount: number;
  exportDoneCount: number;
  lastExportAt: Date | null;
};
type TopupStat = { topupCount: number; topupCredits: number };
type CreditsStat = {
  plan: string;
  totalCredits: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

export type ActivityMaps = {
  projects: Map<string, ProjectStat>;
  clips: Map<string, ClipStat>;
  exports: Map<string, ExportStat>;
  topups: Map<string, TopupStat>;
};

type SalesCache = {
  at: number;
  maps: ActivityMaps;
  summary: Record<SalesSegmentId, number>;
  leads: SalesLead[];
};

let salesCache: SalesCache | null = null;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toMap(rows: { _id: string; count: number }[]) {
  return Object.fromEntries(rows.map((r) => [r._id ?? "unknown", r.count]));
}

function clampPage(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE);
}

const aggOpts = { allowDiskUse: true };

export async function getActivityMaps(): Promise<ActivityMaps> {
  const [projectStats, clipStats, exportStats, topups] = await Promise.all([
    Project.aggregate(
      [
        {
          $group: {
            _id: "$userId",
            projectCount: { $sum: 1 },
            lastProjectAt: { $max: "$createdAt" },
            statusPending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            statusProcessing: {
              $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
            },
            statusDone: {
              $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] },
            },
            statusFailed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
            },
          },
        },
      ],
      aggOpts
    ),
    Clip.aggregate(
      [
        {
          $group: {
            _id: "$userId",
            clipCount: { $sum: 1 },
            lastClipAt: { $max: "$createdAt" },
          },
        },
      ],
      aggOpts
    ),
    Export.aggregate(
      [
        {
          $group: {
            _id: "$userId",
            exportCount: { $sum: 1 },
            exportDoneCount: {
              $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] },
            },
            lastExportAt: { $max: "$createdAt" },
          },
        },
      ],
      aggOpts
    ),
    CreditLedger.aggregate(
      [
        { $match: { type: "grant_topup" } },
        {
          $group: {
            _id: "$userId",
            topupCount: { $sum: 1 },
            topupCredits: { $sum: "$amount" },
          },
        },
      ],
      aggOpts
    ),
  ]);

  return {
    projects: new Map(
      projectStats.map((r) => [
        r._id as string,
        {
          projectCount: r.projectCount,
          lastProjectAt: r.lastProjectAt ? new Date(r.lastProjectAt) : null,
          statusPending: r.statusPending,
          statusProcessing: r.statusProcessing,
          statusDone: r.statusDone,
          statusFailed: r.statusFailed,
        },
      ])
    ),
    clips: new Map(
      clipStats.map((r) => [
        r._id as string,
        {
          clipCount: r.clipCount,
          lastClipAt: r.lastClipAt ? new Date(r.lastClipAt) : null,
        },
      ])
    ),
    exports: new Map(
      exportStats.map((r) => [
        r._id as string,
        {
          exportCount: r.exportCount,
          exportDoneCount: r.exportDoneCount,
          lastExportAt: r.lastExportAt ? new Date(r.lastExportAt) : null,
        },
      ])
    ),
    topups: new Map(
      topups.map((r) => [
        r._id as string,
        { topupCount: r.topupCount, topupCredits: r.topupCredits },
      ])
    ),
  };
}

function buildRow(
  u: {
    _id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    subscriptionStatus?: string;
    isOnboarded?: boolean;
    createdAt?: Date;
  },
  maps: ActivityMaps,
  credits?: CreditsStat | null
): UserMetricsRow {
  const id = u._id;
  const p = maps.projects.get(id);
  const c = maps.clips.get(id);
  const e = maps.exports.get(id);
  const tp = maps.topups.get(id);

  const lastProjectAt = p?.lastProjectAt ?? null;
  const lastExportAt = e?.lastExportAt ?? null;
  let lastVisitedAt: Date | null = null;
  if (lastProjectAt && lastExportAt) {
    lastVisitedAt = lastProjectAt > lastExportAt ? lastProjectAt : lastExportAt;
  } else {
    lastVisitedAt = lastProjectAt ?? lastExportAt;
  }

  return {
    userId: id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    subscriptionStatus: u.subscriptionStatus ?? "free",
    isOnboarded: u.isOnboarded ?? false,
    signedUpAt: u.createdAt,
    plan: credits?.plan ?? "free",
    totalCredits: credits?.totalCredits ?? 0,
    lifetimeEarned: credits?.lifetimeEarned ?? 0,
    lifetimeSpent: credits?.lifetimeSpent ?? 0,
    projectCount: p?.projectCount ?? 0,
    projectsByStatus: {
      pending: p?.statusPending ?? 0,
      processing: p?.statusProcessing ?? 0,
      done: p?.statusDone ?? 0,
      failed: p?.statusFailed ?? 0,
    },
    clipCount: c?.clipCount ?? 0,
    exportCount: e?.exportCount ?? 0,
    exportDoneCount: e?.exportDoneCount ?? 0,
    lastVisitedAt,
    visitCount: (p?.projectCount ?? 0) + (e?.exportCount ?? 0),
    topupCount: tp?.topupCount ?? 0,
    topupCredits: tp?.topupCredits ?? 0,
  };
}

async function loadCreditsMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, CreditsStat>();
  const credits = await UserCredits.find({ _id: { $in: ids } })
    .select("_id plan totalCredits lifetimeEarned lifetimeSpent")
    .lean();
  return new Map(
    credits.map((c) => [
      c._id as string,
      {
        plan: (c.plan as string) ?? "free",
        totalCredits: (c.totalCredits as number) ?? 0,
        lifetimeEarned: (c.lifetimeEarned as number) ?? 0,
        lifetimeSpent: (c.lifetimeSpent as number) ?? 0,
      },
    ])
  );
}

async function hydrateUsers(
  ids: string[],
  maps: ActivityMaps
): Promise<UserMetricsRow[]> {
  if (ids.length === 0) return [];
  const [users, creditsMap] = await Promise.all([
    User.find({ _id: { $in: ids } })
      .select(
        "_id firstName lastName username email subscriptionStatus isOnboarded createdAt"
      )
      .lean(),
    loadCreditsMap(ids),
  ]);
  const byId = new Map(users.map((u) => [u._id as string, u]));
  return ids
    .map((id) => {
      const u = byId.get(id);
      if (!u) return null;
      return buildRow(
        u as Parameters<typeof buildRow>[0],
        maps,
        creditsMap.get(id)
      );
    })
    .filter((r): r is UserMetricsRow => r !== null);
}

async function buildLeaderboards(maps: ActivityMaps) {
  const byProjects = [...maps.projects.entries()]
    .sort((a, b) => b[1].projectCount - a[1].projectCount)
    .slice(0, LEADERBOARD_LIMIT)
    .map(([id]) => id);

  const byClips = [...maps.clips.entries()]
    .sort((a, b) => b[1].clipCount - a[1].clipCount)
    .slice(0, LEADERBOARD_LIMIT)
    .map(([id]) => id);

  const byExports = [...maps.exports.entries()]
    .sort((a, b) => b[1].exportDoneCount - a[1].exportDoneCount)
    .slice(0, LEADERBOARD_LIMIT)
    .map(([id]) => id);

  // Recently active: merge last project/export timestamps, take top N
  const visitScores = new Map<string, number>();
  for (const [id, p] of maps.projects) {
    if (p.lastProjectAt) visitScores.set(id, p.lastProjectAt.getTime());
  }
  for (const [id, e] of maps.exports) {
    if (!e.lastExportAt) continue;
    const t = e.lastExportAt.getTime();
    const prev = visitScores.get(id) ?? 0;
    if (t > prev) visitScores.set(id, t);
  }
  const recentlyActiveIds = [...visitScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LEADERBOARD_LIMIT)
    .map(([id]) => id);

  const allIds = [
    ...new Set([...byProjects, ...byClips, ...byExports, ...recentlyActiveIds]),
  ];
  const hydrated = await hydrateUsers(allIds, maps);
  const rowMap = new Map(hydrated.map((r) => [r.userId, r]));

  const pick = (ids: string[]) =>
    ids.map((id) => rowMap.get(id)).filter((r): r is UserMetricsRow => !!r);

  return {
    topByProjects: pick(byProjects),
    topByClips: pick(byClips),
    topByExports: pick(byExports),
    recentlyActive: pick(recentlyActiveIds),
  };
}

export async function getOverview() {
  const now = new Date();
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);

  const [
    totalUsers,
    users7d,
    users30d,
    onboarded,
    bySubscription,
    byPlan,
    totalProjects,
    projectsByStatus,
    projects7d,
    projects30d,
    totalClips,
    clips7d,
    totalExports,
    exportsByStatus,
    exports7d,
    exportsDone,
    topupRevenue,
    creditSpent,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: d7 } }),
    User.countDocuments({ createdAt: { $gte: d30 } }),
    User.countDocuments({ isOnboarded: true }),
    User.aggregate(
      [{ $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } }],
      aggOpts
    ),
    UserCredits.aggregate(
      [{ $group: { _id: "$plan", count: { $sum: 1 } } }],
      aggOpts
    ),
    Project.countDocuments(),
    Project.aggregate(
      [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      aggOpts
    ),
    Project.countDocuments({ createdAt: { $gte: d7 } }),
    Project.countDocuments({ createdAt: { $gte: d30 } }),
    Clip.countDocuments(),
    Clip.countDocuments({ createdAt: { $gte: d7 } }),
    Export.countDocuments(),
    Export.aggregate(
      [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      aggOpts
    ),
    Export.countDocuments({ createdAt: { $gte: d7 } }),
    Export.countDocuments({ status: "done" }),
    CreditLedger.aggregate(
      [
        { $match: { type: "grant_topup" } },
        {
          $group: {
            _id: null,
            credits: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ],
      aggOpts
    ),
    CreditLedger.aggregate(
      [
        { $match: { type: { $in: ["job_cost", "export_cost"] } } },
        { $group: { _id: null, credits: { $sum: "$amount" } } },
      ],
      aggOpts
    ),
  ]);

  return {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      last7d: users7d,
      last30d: users30d,
      onboarded,
      bySubscription: toMap(bySubscription),
      byPlan: toMap(byPlan),
    },
    projects: {
      total: totalProjects,
      last7d: projects7d,
      last30d: projects30d,
      byStatus: toMap(projectsByStatus),
    },
    clips: {
      total: totalClips,
      last7d: clips7d,
    },
    exports: {
      total: totalExports,
      last7d: exports7d,
      done: exportsDone,
      byStatus: toMap(exportsByStatus),
    },
    credits: {
      topupGrants: topupRevenue[0]?.count ?? 0,
      topupCreditsGranted: topupRevenue[0]?.credits ?? 0,
      creditsSpent: Math.abs(creditSpent[0]?.credits ?? 0),
    },
  };
}

export type UsersSort = "recent" | "projects" | "clips" | "exports" | "signup";

export type PlanFilter = "all" | "free" | "core" | "growth" | "scale";
export type StatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "cancelled"
  | "free";
export type ActivityFilter =
  | "all"
  | "has_projects"
  | "never_started"
  | "has_exports"
  | "no_exports"
  | "topped_up";
export type SignupFilter = "all" | "7d" | "30d";
export type OnboardedFilter = "all" | "yes" | "no";

export type UsersListFilters = {
  plan?: PlanFilter;
  status?: StatusFilter;
  activity?: ActivityFilter;
  signup?: SignupFilter;
  onboarded?: OnboardedFilter;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match name, email, username, or id. Supports "first last" as AND. */
function userSearchFilter(q: string): Record<string, unknown> | null {
  const trimmed = q.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const rx = new RegExp(escapeRegex(trimmed), "i");
  const or: Record<string, unknown>[] = [
    { firstName: rx },
    { lastName: rx },
    { email: rx },
    { username: rx },
    { _id: rx },
  ];

  if (parts.length >= 2) {
    or.push({
      $and: [
        { firstName: new RegExp(escapeRegex(parts[0]!), "i") },
        { lastName: new RegExp(escapeRegex(parts.slice(1).join(" ")), "i") },
      ],
    });
  }

  return { $or: or };
}

function normalizePlan(v?: string): PlanFilter {
  if (v === "free" || v === "core" || v === "growth" || v === "scale") return v;
  return "all";
}

function normalizeStatus(v?: string): StatusFilter {
  if (
    v === "active" ||
    v === "inactive" ||
    v === "cancelled" ||
    v === "free"
  ) {
    return v;
  }
  return "all";
}

function normalizeActivity(v?: string): ActivityFilter {
  if (
    v === "has_projects" ||
    v === "never_started" ||
    v === "has_exports" ||
    v === "no_exports" ||
    v === "topped_up"
  ) {
    return v;
  }
  return "all";
}

function normalizeSignup(v?: string): SignupFilter {
  if (v === "7d" || v === "30d") return v;
  return "all";
}

function normalizeOnboarded(v?: string): OnboardedFilter {
  if (v === "yes" || v === "no") return v;
  return "all";
}

export function parseUsersListFilters(
  sp: URLSearchParams | { get(name: string): string | null }
): UsersListFilters {
  return {
    plan: normalizePlan(sp.get("plan") ?? undefined),
    status: normalizeStatus(sp.get("status") ?? undefined),
    activity: normalizeActivity(sp.get("activity") ?? undefined),
    signup: normalizeSignup(sp.get("signup") ?? undefined),
    onboarded: normalizeOnboarded(sp.get("onboarded") ?? undefined),
  };
}

function hasActiveListFilters(filters: UsersListFilters, q?: string) {
  return Boolean(
    q?.trim() ||
      (filters.plan && filters.plan !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.activity && filters.activity !== "all") ||
      (filters.signup && filters.signup !== "all") ||
      (filters.onboarded && filters.onboarded !== "all")
  );
}

async function buildUsersListFilter(
  opts: UsersListFilters & { q?: string; maps: ActivityMaps }
): Promise<Record<string, unknown>> {
  const and: Record<string, unknown>[] = [];

  const search = userSearchFilter(opts.q ?? "");
  if (search) and.push(search);

  if (opts.status && opts.status !== "all") {
    and.push({ subscriptionStatus: opts.status });
  }

  if (opts.onboarded === "yes") and.push({ isOnboarded: true });
  if (opts.onboarded === "no") and.push({ isOnboarded: { $ne: true } });

  if (opts.signup === "7d") and.push({ createdAt: { $gte: daysAgo(7) } });
  if (opts.signup === "30d") and.push({ createdAt: { $gte: daysAgo(30) } });

  if (opts.plan && opts.plan !== "all") {
    if (opts.plan === "free") {
      // Missing credits docs also count as free in the UI
      const paidIds = await UserCredits.distinct("_id", {
        plan: { $ne: "free" },
      });
      if (paidIds.length > 0) and.push({ _id: { $nin: paidIds } });
    } else {
      const ids = await UserCredits.distinct("_id", { plan: opts.plan });
      and.push({ _id: { $in: ids } });
    }
  }

  if (opts.activity && opts.activity !== "all") {
    const { maps } = opts;
    if (opts.activity === "has_projects") {
      const ids = [...maps.projects.entries()]
        .filter(([, p]) => p.projectCount > 0)
        .map(([id]) => id);
      and.push({ _id: { $in: ids } });
    } else if (opts.activity === "never_started") {
      const ids = [...maps.projects.keys()];
      if (ids.length > 0) and.push({ _id: { $nin: ids } });
    } else if (opts.activity === "has_exports") {
      const ids = [...maps.exports.entries()]
        .filter(([, e]) => e.exportDoneCount > 0)
        .map(([id]) => id);
      and.push({ _id: { $in: ids } });
    } else if (opts.activity === "no_exports") {
      const withExports = new Set(
        [...maps.exports.entries()]
          .filter(([, e]) => e.exportDoneCount > 0)
          .map(([id]) => id)
      );
      const ids = [...maps.projects.entries()]
        .filter(([id, p]) => p.projectCount > 0 && !withExports.has(id))
        .map(([id]) => id);
      and.push({ _id: { $in: ids } });
    } else if (opts.activity === "topped_up") {
      const ids = [...maps.topups.keys()];
      and.push({ _id: { $in: ids } });
    }
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0]!;
  return { $and: and };
}

export async function getUsersMetrics(opts?: {
  page?: number;
  limit?: number;
  sort?: UsersSort;
  q?: string;
  maps?: ActivityMaps;
} & UsersListFilters) {
  const page = clampPage(opts?.page ?? 1);
  const limit = clampLimit(opts?.limit ?? DEFAULT_PAGE_SIZE);
  const sort = opts?.sort ?? "recent";
  const filters: UsersListFilters = {
    plan: normalizePlan(opts?.plan),
    status: normalizeStatus(opts?.status),
    activity: normalizeActivity(opts?.activity),
    signup: normalizeSignup(opts?.signup),
    onboarded: normalizeOnboarded(opts?.onboarded),
  };
  const maps = opts?.maps ?? (await getActivityMaps());
  const useDbList =
    sort === "signup" || hasActiveListFilters(filters, opts?.q);

  const totalUsers = await User.countDocuments();

  // Paginated list: for activity sorts, rank from maps; for signup/search/filters use DB skip/limit
  let pageRows: UserMetricsRow[] = [];

  if (useDbList) {
    const filter = await buildUsersListFilter({
      ...filters,
      q: opts?.q,
      maps,
    });
    const [matchedTotal, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "_id firstName lastName username email subscriptionStatus isOnboarded createdAt"
        )
        .lean(),
    ]);
    const ids = users.map((u) => u._id as string);
    const creditsMap = await loadCreditsMap(ids);
    pageRows = users.map((u) =>
      buildRow(
        u as Parameters<typeof buildRow>[0],
        maps,
        creditsMap.get(u._id as string)
      )
    );

    const totalPages = Math.max(1, Math.ceil(matchedTotal / limit));
    return {
      totalUsers,
      page,
      limit,
      totalPages,
      totalInView: matchedTotal,
      sort: hasActiveListFilters(filters, opts?.q)
        ? ("signup" as const)
        : sort,
      q: opts?.q?.trim() || undefined,
      filters,
      users: pageRows,
    };
  }

  let rankedIds: string[] = [];
  if (sort === "projects") {
    rankedIds = [...maps.projects.entries()]
      .sort((a, b) => b[1].projectCount - a[1].projectCount)
      .map(([id]) => id);
  } else if (sort === "clips") {
    rankedIds = [...maps.clips.entries()]
      .sort((a, b) => b[1].clipCount - a[1].clipCount)
      .map(([id]) => id);
  } else if (sort === "exports") {
    rankedIds = [...maps.exports.entries()]
      .sort((a, b) => b[1].exportDoneCount - a[1].exportDoneCount)
      .map(([id]) => id);
  } else {
    // recent — users with any visit signal
    const visitScores = new Map<string, number>();
    for (const [id, p] of maps.projects) {
      if (p.lastProjectAt) visitScores.set(id, p.lastProjectAt.getTime());
    }
    for (const [id, e] of maps.exports) {
      if (!e.lastExportAt) continue;
      const t = e.lastExportAt.getTime();
      if (t > (visitScores.get(id) ?? 0)) visitScores.set(id, t);
    }
    rankedIds = [...visitScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  const totalRanked = rankedIds.length;
  const slice = rankedIds.slice((page - 1) * limit, page * limit);
  pageRows = await hydrateUsers(slice, maps);

  const totalPages = Math.max(1, Math.ceil(totalRanked / limit));
  return {
    totalUsers,
    page,
    limit,
    totalPages,
    totalInView: totalRanked,
    sort,
    filters,
    users: pageRows,
  };
}

async function buildSalesLeadsFromMaps(maps: ActivityMaps): Promise<{
  summary: Record<SalesSegmentId, number>;
  leads: SalesLead[];
}> {
  const summary = {
    stuck_failures: 0,
    upgrade_ready: 0,
    low_credits: 0,
    topup_upsell: 0,
    no_export: 0,
    churn_risk: 0,
    new_hot: 0,
    never_started: 0,
    paid_champion: 0,
  } as Record<SalesSegmentId, number>;

  const leads: SalesLead[] = [];
  let batch: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    subscriptionStatus?: string;
    isOnboarded?: boolean;
    createdAt?: Date;
  }> = [];

  const cursor = User.find()
    .select(
      "_id firstName lastName username email subscriptionStatus isOnboarded createdAt"
    )
    .lean()
    .cursor();

  async function flush() {
    if (batch.length === 0) return;
    const ids = batch.map((u) => u._id);
    const creditsMap = await loadCreditsMap(ids);
    for (const u of batch) {
      const row = buildRow(u, maps, creditsMap.get(u._id));
      const lead = toSalesLead(row);
      if (!lead) continue;
      summary[lead.segment] += 1;
      leads.push(lead);
    }
    batch = [];
  }

  for await (const u of cursor) {
    batch.push(u as (typeof batch)[number]);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  leads.sort((a, b) => a.priority - b.priority || b.visitCount - a.visitCount);
  return { summary, leads };
}

async function getSalesCache(fresh = false): Promise<SalesCache> {
  if (
    !fresh &&
    salesCache &&
    Date.now() - salesCache.at < CACHE_TTL_MS
  ) {
    return salesCache;
  }

  const maps = await getActivityMaps();
  const { summary, leads } = await buildSalesLeadsFromMaps(maps);
  salesCache = { at: Date.now(), maps, summary, leads };
  return salesCache;
}

export function bustMetricsCache() {
  salesCache = null;
}

export async function getSalesOutreach(opts?: {
  page?: number;
  limit?: number;
  segment?: SalesSegmentId | "all";
  fresh?: boolean;
}) {
  const page = clampPage(opts?.page ?? 1);
  const limit = clampLimit(opts?.limit ?? DEFAULT_PAGE_SIZE);
  const segment = opts?.segment ?? "all";
  const cache = await getSalesCache(opts?.fresh ?? false);

  const filtered =
    segment === "all"
      ? cache.leads
      : cache.leads.filter((l) => l.segment === segment);

  const totalLeads = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / limit));
  const safePage = Math.min(page, totalPages);
  const leads = filtered.slice((safePage - 1) * limit, safePage * limit);

  return {
    totalLeads: cache.leads.length,
    filteredTotal: totalLeads,
    summary: cache.summary,
    page: safePage,
    limit,
    totalPages,
    segment,
    leads,
  };
}

/** One-shot dashboard load — activity maps computed once. */
export async function getDashboardSnapshot(opts?: { fresh?: boolean }) {
  if (opts?.fresh) bustMetricsCache();

  const [overview, cache] = await Promise.all([
    getOverview(),
    getSalesCache(opts?.fresh ?? true),
  ]);

  const leaderboards = await buildLeaderboards(cache.maps);
  const totalUsers = overview.users.total;

  const salesPage = cache.leads.slice(0, DEFAULT_PAGE_SIZE);
  const salesTotalPages = Math.max(
    1,
    Math.ceil(cache.leads.length / DEFAULT_PAGE_SIZE)
  );

  return {
    overview,
    totalUsers,
    leaderboards,
    sales: {
      totalLeads: cache.leads.length,
      filteredTotal: cache.leads.length,
      summary: cache.summary,
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      totalPages: salesTotalPages,
      segment: "all" as const,
      leads: salesPage,
    },
  };
}

export async function getProjectsMetrics(opts?: {
  page?: number;
  limit?: number;
}) {
  const page = clampPage(opts?.page ?? 1);
  const limit = clampLimit(opts?.limit ?? 50);

  const [total, recent, byDay] = await Promise.all([
    Project.countDocuments(),
    Project.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "_id userId title status totalClips videoDuration aspectRatio createdAt updatedAt error"
      )
      .lean(),
    Project.aggregate(
      [
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
            done: {
              $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ],
      aggOpts
    ),
  ]);

  return {
    recent,
    byDay,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
