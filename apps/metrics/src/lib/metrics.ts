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

export async function getUsersMetrics(opts?: {
  page?: number;
  limit?: number;
  sort?: UsersSort;
  maps?: ActivityMaps;
}) {
  const page = clampPage(opts?.page ?? 1);
  const limit = clampLimit(opts?.limit ?? DEFAULT_PAGE_SIZE);
  const sort = opts?.sort ?? "recent";
  const maps = opts?.maps ?? (await getActivityMaps());

  const [totalUsers, leaderboards] = await Promise.all([
    User.countDocuments(),
    buildLeaderboards(maps),
  ]);

  // Paginated list: for activity sorts, rank from maps; for signup use DB skip/limit
  let pageRows: UserMetricsRow[] = [];

  if (sort === "signup") {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "_id firstName lastName username email subscriptionStatus isOnboarded createdAt"
      )
      .lean();
    const ids = users.map((u) => u._id as string);
    const creditsMap = await loadCreditsMap(ids);
    pageRows = users.map((u) =>
      buildRow(
        u as Parameters<typeof buildRow>[0],
        maps,
        creditsMap.get(u._id as string)
      )
    );
  } else {
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
      users: pageRows,
      leaderboards,
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalUsers / limit));
  return {
    totalUsers,
    page,
    limit,
    totalPages,
    totalInView: totalUsers,
    sort,
    users: pageRows,
    leaderboards,
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
