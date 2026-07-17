import {
  User,
  Project,
  Clip,
  Export,
  UserCredits,
  CreditLedger,
} from "./models";
import { buildSalesLeads, type UserMetricsRow } from "./sales";

const LIMIT = 50;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toMap(rows: { _id: string; count: number }[]) {
  return Object.fromEntries(rows.map((r) => [r._id ?? "unknown", r.count]));
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
    User.aggregate([{ $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } }]),
    UserCredits.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
    Project.countDocuments(),
    Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Project.countDocuments({ createdAt: { $gte: d7 } }),
    Project.countDocuments({ createdAt: { $gte: d30 } }),
    Clip.countDocuments(),
    Clip.countDocuments({ createdAt: { $gte: d7 } }),
    Export.countDocuments(),
    Export.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Export.countDocuments({ createdAt: { $gte: d7 } }),
    Export.countDocuments({ status: "done" }),
    CreditLedger.aggregate([
      { $match: { type: "grant_topup" } },
      { $group: { _id: null, credits: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    CreditLedger.aggregate([
      { $match: { type: { $in: ["job_cost", "export_cost"] } } },
      { $group: { _id: null, credits: { $sum: "$amount" } } },
    ]),
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

export async function getUsersMetrics() {
  const [projectStats, clipStats, exportStats, allUsers, credits, topups] =
    await Promise.all([
      Project.aggregate([
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
      ]),
      Clip.aggregate([
        {
          $group: {
            _id: "$userId",
            clipCount: { $sum: 1 },
            lastClipAt: { $max: "$createdAt" },
          },
        },
      ]),
      Export.aggregate([
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
      ]),
      User.find()
        .select(
          "_id firstName lastName username email avatarUrl subscriptionStatus isOnboarded createdAt updatedAt ssoProvider"
        )
        .lean(),
      UserCredits.find()
        .select(
          "_id plan subscriptionCredits topupCredits totalCredits lifetimeEarned lifetimeSpent cycleStart cycleEnd"
        )
        .lean(),
      CreditLedger.aggregate([
        { $match: { type: "grant_topup" } },
        {
          $group: {
            _id: "$userId",
            topupCount: { $sum: 1 },
            topupCredits: { $sum: "$amount" },
          },
        },
      ]),
    ]);

  const projectMap = new Map(projectStats.map((r) => [r._id, r]));
  const clipMap = new Map(clipStats.map((r) => [r._id, r]));
  const exportMap = new Map(exportStats.map((r) => [r._id, r]));
  const creditsMap = new Map(credits.map((c) => [c._id, c]));
  const topupMap = new Map(topups.map((t) => [t._id, t]));

  const rows: UserMetricsRow[] = allUsers.map((u) => {
    const p = projectMap.get(u._id as string);
    const c = clipMap.get(u._id as string);
    const e = exportMap.get(u._id as string);
    const cr = creditsMap.get(u._id as string);
    const tp = topupMap.get(u._id as string);

    const lastProjectAt = p?.lastProjectAt ? new Date(p.lastProjectAt) : null;
    const lastExportAt = e?.lastExportAt ? new Date(e.lastExportAt) : null;

    let lastVisitedAt: Date | null = null;
    if (lastProjectAt && lastExportAt) {
      lastVisitedAt = lastProjectAt > lastExportAt ? lastProjectAt : lastExportAt;
    } else {
      lastVisitedAt = lastProjectAt ?? lastExportAt;
    }

    const visitCount = (p?.projectCount ?? 0) + (e?.exportCount ?? 0);

    return {
      userId: u._id as string,
      firstName: u.firstName as string | undefined,
      lastName: u.lastName as string | undefined,
      username: u.username as string | undefined,
      email: u.email as string | undefined,
      subscriptionStatus: (u.subscriptionStatus as string) ?? "free",
      isOnboarded: (u.isOnboarded as boolean) ?? false,
      signedUpAt: u.createdAt as Date,
      plan: (cr?.plan as string) ?? "free",
      totalCredits: (cr?.totalCredits as number) ?? 0,
      lifetimeEarned: (cr?.lifetimeEarned as number) ?? 0,
      lifetimeSpent: (cr?.lifetimeSpent as number) ?? 0,
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
      visitCount,
      topupCount: tp?.topupCount ?? 0,
      topupCredits: tp?.topupCredits ?? 0,
    };
  });

  rows.sort((a, b) => {
    const ta = a.lastVisitedAt ? new Date(a.lastVisitedAt).getTime() : 0;
    const tb = b.lastVisitedAt ? new Date(b.lastVisitedAt).getTime() : 0;
    return tb - ta;
  });

  return {
    totalUsers: rows.length,
    users: rows,
    leaderboards: {
      topByProjects: [...rows].sort((a, b) => b.projectCount - a.projectCount).slice(0, LIMIT),
      topByClips: [...rows].sort((a, b) => b.clipCount - a.clipCount).slice(0, LIMIT),
      topByExports: [...rows]
        .sort((a, b) => b.exportDoneCount - a.exportDoneCount)
        .slice(0, LIMIT),
      recentlyActive: rows.filter((r) => r.lastVisitedAt).slice(0, LIMIT),
    },
  };
}

export async function getSalesOutreach() {
  const { users } = await getUsersMetrics();
  const { summary, leads, bySegment } = buildSalesLeads(users);

  // Cap each segment for the UI
  const capped: typeof bySegment = { ...bySegment };
  for (const key of Object.keys(capped) as (keyof typeof capped)[]) {
    capped[key] = capped[key].slice(0, LIMIT);
  }

  return {
    totalLeads: leads.length,
    summary,
    leads: leads.slice(0, 100),
    bySegment: capped,
  };
}

export async function getProjectsMetrics() {
  const recent = await Project.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .select(
      "_id userId title status totalClips videoDuration aspectRatio createdAt updatedAt error"
    )
    .lean();

  const byDay = await Project.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
  ]);

  return { recent, byDay };
}
