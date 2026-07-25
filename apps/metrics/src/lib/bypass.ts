/**
 * Free-plan constraint bypass detection.
 *
 * Free limits today: 30 min / 150 credits.
 * Previous free limits: 45 min / 250 credits.
 * (No worker-side maxVideoLengthMins check — client can omit durationSecs.)
 */

import { User, Project, CreditLedger } from "./models";
import type { ParsedDateRange } from "./date-range";

/** Current free plan video length (mins). */
export const FREE_MAX_MINS_CURRENT = 30;
/** Previous free plan / legacy ceiling (mins). */
export const FREE_MAX_MINS_LEGACY = 45;
/** Current free plan monthly credits. */
export const FREE_CREDITS_CURRENT = 150;
/** Previous free plan monthly credits. */
export const FREE_CREDITS_LEGACY = 250;
export const CREDITS_PER_MIN = 2;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const CACHE_TTL_MS = 2 * 60 * 1000;
const aggOpts = { allowDiskUse: true };

export type BypassSeverity = "soft" | "hard";
/** soft = over 30 but ≤45; hard = over 45 (legacy ceiling too). */

export type BypassProjectRow = {
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
  severity: BypassSeverity;
  exceedsCurrentLimit: boolean;
  exceedsLegacyLimit: boolean;
  exceedsCurrentCredits: boolean;
  exceedsLegacyCredits: boolean;
  createdAt: string | null;
  updatedAt: string | null;
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

export type BypassUserRow = {
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

export type BypassSummary = {
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

export type BypassThreshold = "30" | "45";
export type BypassView = "projects" | "users";
export type BypassSortDir = "asc" | "desc";
export type BypassSort =
  | "severity"
  | "duration"
  | "title"
  | "user"
  | "email"
  | "status"
  | "credits"
  | "created"
  | "overLimitCount"
  | "balance"
  | "link";

const SORT_KEYS = new Set<BypassSort>([
  "severity",
  "duration",
  "title",
  "user",
  "email",
  "status",
  "credits",
  "created",
  "overLimitCount",
  "balance",
  "link",
]);

export function parseBypassSort(v?: string | null): BypassSort {
  if (v && SORT_KEYS.has(v as BypassSort)) return v as BypassSort;
  return "duration";
}

export function parseBypassSortDir(v?: string | null): BypassSortDir {
  return v === "asc" ? "asc" : "desc";
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function cmpNum(a: number, b: number) {
  return a - b;
}

type BypassCache = {
  at: number;
  projects: BypassProjectRow[];
  users: BypassUserRow[];
  summary: BypassSummary;
};

let bypassCache: BypassCache | null = null;

function clampPage(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE);
}

function secsToMins(secs: number) {
  return Math.round((secs / 60) * 10) / 10;
}

function estimateCredits(durationSecs: number) {
  return Math.max(CREDITS_PER_MIN, Math.ceil(durationSecs / 60) * CREDITS_PER_MIN);
}

function severityFor(durationSecs: number): BypassSeverity {
  return durationSecs > FREE_MAX_MINS_LEGACY * 60 ? "hard" : "soft";
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toISOString();
}

async function buildBypassDataset(): Promise<BypassCache> {
  const minSecs = FREE_MAX_MINS_CURRENT * 60;

  // Long videos first, then keep only free-plan owners (missing credits doc = free).
  const raw = await Project.aggregate(
    [
      {
        $match: {
          videoDuration: { $gt: minSecs },
        },
      },
      {
        $lookup: {
          from: "usercredits",
          localField: "userId",
          foreignField: "_id",
          as: "credits",
        },
      },
      {
        $addFields: {
          plan: {
            $ifNull: [{ $arrayElemAt: ["$credits.plan", 0] }, "free"],
          },
          lifetimeSpent: {
            $ifNull: [{ $arrayElemAt: ["$credits.lifetimeSpent", 0] }, 0],
          },
          totalCredits: {
            $ifNull: [{ $arrayElemAt: ["$credits.totalCredits", 0] }, 0],
          },
          topupCredits: {
            $ifNull: [{ $arrayElemAt: ["$credits.topupCredits", 0] }, 0],
          },
        },
      },
      { $match: { plan: "free" } },
      { $sort: { videoDuration: -1, createdAt: -1 } },
    ],
    aggOpts
  );

  const userIds = [...new Set(raw.map((p) => p.userId as string))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select(
          "_id firstName lastName username email subscriptionStatus"
        )
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id as string, u]));

  // Optional: actual job_cost rows for these jobs (ground truth when present)
  const jobIds = raw
    .map((p) => p.jobId as string | undefined)
    .filter((id): id is string => Boolean(id));
  const ledgerByJob = new Map<string, number>();
  if (jobIds.length > 0) {
    const ledgers = await CreditLedger.aggregate(
      [
        {
          $match: {
            type: "job_cost",
            jobId: { $in: jobIds },
          },
        },
        {
          $group: {
            _id: "$jobId",
            spent: { $sum: { $abs: "$amount" } },
          },
        },
      ],
      aggOpts
    );
    for (const row of ledgers) {
      ledgerByJob.set(row._id as string, row.spent as number);
    }
  }

  const projects: BypassProjectRow[] = raw.map((p) => {
    const secs = Number(p.videoDuration) || 0;
    const mins = secsToMins(secs);
    const estimated =
      (p.jobId && ledgerByJob.get(p.jobId as string)) ||
      estimateCredits(secs);
    const u = userMap.get(p.userId as string);
    return {
      projectId: p._id as string,
      jobId: p.jobId as string | undefined,
      title: (p.title as string) || "(untitled)",
      name: p.name as string | undefined,
      sourceUrl: p.sourceUrl as string | undefined,
      status: (p.status as string) || "unknown",
      totalClips: (p.totalClips as number) ?? 0,
      videoDurationSecs: secs,
      videoDurationMins: mins,
      estimatedCredits: estimated,
      severity: severityFor(secs),
      exceedsCurrentLimit: secs > FREE_MAX_MINS_CURRENT * 60,
      exceedsLegacyLimit: secs > FREE_MAX_MINS_LEGACY * 60,
      exceedsCurrentCredits: estimated > FREE_CREDITS_CURRENT,
      exceedsLegacyCredits: estimated > FREE_CREDITS_LEGACY,
      createdAt: iso(p.createdAt as Date | undefined),
      updatedAt: iso(p.updatedAt as Date | undefined),
      error: p.error as string | undefined,
      userId: p.userId as string,
      firstName: u?.firstName as string | undefined,
      lastName: u?.lastName as string | undefined,
      username: u?.username as string | undefined,
      email: u?.email as string | undefined,
      plan: (p.plan as string) || "free",
      subscriptionStatus: (u?.subscriptionStatus as string) || "free",
      lifetimeSpent: (p.lifetimeSpent as number) ?? 0,
      totalCredits: (p.totalCredits as number) ?? 0,
      topupCredits: (p.topupCredits as number) ?? 0,
    };
  });

  // Per-user rollup
  const byUser = new Map<string, BypassUserRow>();
  for (const p of projects) {
    let row = byUser.get(p.userId);
    if (!row) {
      row = {
        userId: p.userId,
        firstName: p.firstName,
        lastName: p.lastName,
        username: p.username,
        email: p.email,
        plan: p.plan,
        subscriptionStatus: p.subscriptionStatus,
        lifetimeSpent: p.lifetimeSpent,
        totalCredits: p.totalCredits,
        topupCredits: p.topupCredits,
        overLimitCount: 0,
        hardBypassCount: 0,
        softBypassCount: 0,
        maxDurationMins: 0,
        totalEstimatedCredits: 0,
        longestSourceUrl: p.sourceUrl,
        lastBypassAt: p.createdAt,
      };
      byUser.set(p.userId, row);
    }
    row.overLimitCount += 1;
    if (p.severity === "hard") row.hardBypassCount += 1;
    else row.softBypassCount += 1;
    row.totalEstimatedCredits += p.estimatedCredits;
    if (p.videoDurationMins > row.maxDurationMins) {
      row.maxDurationMins = p.videoDurationMins;
      row.longestSourceUrl = p.sourceUrl;
    }
    if (
      p.createdAt &&
      (!row.lastBypassAt || p.createdAt > row.lastBypassAt)
    ) {
      row.lastBypassAt = p.createdAt;
    }
  }

  const usersRows = [...byUser.values()].sort(
    (a, b) =>
      b.hardBypassCount - a.hardBypassCount ||
      b.maxDurationMins - a.maxDurationMins ||
      b.overLimitCount - a.overLimitCount
  );

  const byStatus: Record<string, number> = {};
  let sumMins = 0;
  let maxMins = 0;
  let softCount = 0;
  let hardCount = 0;
  let overLegacyMins = 0;
  let overCurrentCredits = 0;
  let overLegacyCredits = 0;
  let totalEstimatedCredits = 0;

  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    sumMins += p.videoDurationMins;
    if (p.videoDurationMins > maxMins) maxMins = p.videoDurationMins;
    if (p.severity === "hard") hardCount += 1;
    else softCount += 1;
    if (p.exceedsLegacyLimit) overLegacyMins += 1;
    if (p.exceedsCurrentCredits) overCurrentCredits += 1;
    if (p.exceedsLegacyCredits) overLegacyCredits += 1;
    totalEstimatedCredits += p.estimatedCredits;
  }

  const summary: BypassSummary = {
    totalProjects: projects.length,
    softCount,
    hardCount,
    uniqueUsers: usersRows.length,
    overLegacyMins,
    overCurrentCredits,
    overLegacyCredits,
    maxDurationMins: maxMins,
    avgDurationMins:
      projects.length > 0
        ? Math.round((sumMins / projects.length) * 10) / 10
        : 0,
    totalEstimatedCredits,
    byStatus,
  };

  return {
    at: Date.now(),
    projects,
    users: usersRows,
    summary,
  };
}

async function getBypassCache(fresh = false): Promise<BypassCache> {
  if (
    !fresh &&
    bypassCache &&
    Date.now() - bypassCache.at < CACHE_TTL_MS
  ) {
    return bypassCache;
  }
  bypassCache = await buildBypassDataset();
  return bypassCache;
}

export function bustBypassCache() {
  bypassCache = null;
}

function matchesSearch(q: string, p: BypassProjectRow) {
  const hay = [
    p.title,
    p.name,
    p.sourceUrl,
    p.email,
    p.username,
    p.firstName,
    p.lastName,
    p.userId,
    p.projectId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function matchesUserSearch(q: string, u: BypassUserRow) {
  const hay = [
    u.email,
    u.username,
    u.firstName,
    u.lastName,
    u.userId,
    u.longestSourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export async function getFreePlanBypasses(opts?: {
  page?: number;
  limit?: number;
  threshold?: BypassThreshold;
  view?: BypassView;
  sort?: BypassSort;
  sortDir?: BypassSortDir;
  severity?: BypassSeverity | "all";
  q?: string;
  fresh?: boolean;
  range?: ParsedDateRange;
}) {
  const page = clampPage(opts?.page ?? 1);
  const limit = clampLimit(opts?.limit ?? DEFAULT_PAGE_SIZE);
  const threshold = opts?.threshold === "45" ? "45" : "30";
  const view = opts?.view === "users" ? "users" : "projects";
  const severity = opts?.severity ?? "all";
  const q = opts?.q?.trim() ?? "";
  const sortDir = opts?.sortDir ?? "desc";
  const dirMul = sortDir === "asc" ? 1 : -1;
  const cache = await getBypassCache(opts?.fresh ?? false);
  const range = opts?.range;

  const minSecs =
    threshold === "45"
      ? FREE_MAX_MINS_LEGACY * 60
      : FREE_MAX_MINS_CURRENT * 60;

  let projects = cache.projects.filter((p) => p.videoDurationSecs > minSecs);

  if (range?.from || range?.to) {
    const fromMs = range.from?.getTime() ?? 0;
    const toMs = range.to?.getTime() ?? Number.POSITIVE_INFINITY;
    projects = projects.filter((p) => {
      if (!p.createdAt) return false;
      const t = new Date(p.createdAt).getTime();
      return t >= fromMs && t <= toMs;
    });
  }

  if (severity === "soft") {
    projects = projects.filter((p) => p.severity === "soft");
  } else if (severity === "hard") {
    projects = projects.filter((p) => p.severity === "hard");
  }
  if (q) {
    projects = projects.filter((p) => matchesSearch(q, p));
  }

  const sort = parseBypassSort(opts?.sort);
  projects = [...projects].sort((a, b) => {
    let raw = 0;
    switch (sort) {
      case "severity":
        raw = cmpNum(
          a.severity === "hard" ? 1 : 0,
          b.severity === "hard" ? 1 : 0
        );
        if (raw === 0) raw = cmpNum(a.videoDurationSecs, b.videoDurationSecs);
        break;
      case "created":
        raw = cmpStr(a.createdAt ?? "", b.createdAt ?? "");
        break;
      case "credits":
        raw = cmpNum(a.estimatedCredits, b.estimatedCredits);
        break;
      case "user":
        raw = cmpStr(
          `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(),
          `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim()
        );
        break;
      case "email":
        raw = cmpStr(
          (a.email || a.username || "").toLowerCase(),
          (b.email || b.username || "").toLowerCase()
        );
        break;
      case "status":
        raw = cmpStr(a.status, b.status);
        break;
      case "title":
        raw = cmpStr(
          (a.name || a.title || "").toLowerCase(),
          (b.name || b.title || "").toLowerCase()
        );
        if (raw === 0) {
          raw = cmpStr(
            (a.sourceUrl || "").toLowerCase(),
            (b.sourceUrl || "").toLowerCase()
          );
        }
        break;
      case "link":
        raw = cmpStr(
          (a.sourceUrl || "").toLowerCase(),
          (b.sourceUrl || "").toLowerCase()
        );
        break;
      case "duration":
      default:
        raw = cmpNum(a.videoDurationSecs, b.videoDurationSecs);
        break;
    }
    return raw * dirMul;
  });

  // Rebuild user rollup from filtered projects when filtering
  let users = cache.users;
  const rangeFiltered = Boolean(range?.from || range?.to);
  if (threshold === "45" || severity !== "all" || q || rangeFiltered) {
    const map = new Map<string, BypassUserRow>();
    for (const p of projects) {
      let row = map.get(p.userId);
      if (!row) {
        row = {
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          username: p.username,
          email: p.email,
          plan: p.plan,
          subscriptionStatus: p.subscriptionStatus,
          lifetimeSpent: p.lifetimeSpent,
          totalCredits: p.totalCredits,
          topupCredits: p.topupCredits,
          overLimitCount: 0,
          hardBypassCount: 0,
          softBypassCount: 0,
          maxDurationMins: 0,
          totalEstimatedCredits: 0,
          longestSourceUrl: p.sourceUrl,
          lastBypassAt: p.createdAt,
        };
        map.set(p.userId, row);
      }
      row.overLimitCount += 1;
      if (p.severity === "hard") row.hardBypassCount += 1;
      else row.softBypassCount += 1;
      row.totalEstimatedCredits += p.estimatedCredits;
      if (p.videoDurationMins > row.maxDurationMins) {
        row.maxDurationMins = p.videoDurationMins;
        row.longestSourceUrl = p.sourceUrl;
      }
      if (
        p.createdAt &&
        (!row.lastBypassAt || p.createdAt > row.lastBypassAt)
      ) {
        row.lastBypassAt = p.createdAt;
      }
    }
    users = [...map.values()];
  }
  if (q && view === "users") {
    users = users.filter((u) => matchesUserSearch(q, u));
  }

  const userSort =
    opts?.sort && SORT_KEYS.has(opts.sort) ? opts.sort : "overLimitCount";
  users = [...users].sort((a, b) => {
    let raw = 0;
    switch (userSort) {
      case "duration":
        raw = cmpNum(a.maxDurationMins, b.maxDurationMins);
        break;
      case "credits":
        raw = cmpNum(a.totalEstimatedCredits, b.totalEstimatedCredits);
        break;
      case "user":
        raw = cmpStr(
          `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(),
          `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim()
        );
        break;
      case "email":
        raw = cmpStr(
          (a.email || a.username || "").toLowerCase(),
          (b.email || b.username || "").toLowerCase()
        );
        break;
      case "created":
        raw = cmpStr(a.lastBypassAt ?? "", b.lastBypassAt ?? "");
        break;
      case "balance":
        raw = cmpNum(a.lifetimeSpent, b.lifetimeSpent);
        if (raw === 0) raw = cmpNum(a.totalCredits, b.totalCredits);
        break;
      case "link":
        raw = cmpStr(
          (a.longestSourceUrl || "").toLowerCase(),
          (b.longestSourceUrl || "").toLowerCase()
        );
        break;
      case "severity":
        raw = cmpNum(a.hardBypassCount, b.hardBypassCount);
        if (raw === 0) raw = cmpNum(a.overLimitCount, b.overLimitCount);
        break;
      case "overLimitCount":
      default:
        raw =
          cmpNum(a.hardBypassCount, b.hardBypassCount) ||
          cmpNum(a.overLimitCount, b.overLimitCount) ||
          cmpNum(a.maxDurationMins, b.maxDurationMins);
        break;
    }
    return raw * dirMul;
  });

  // Filtered summary (respects threshold + severity + search on projects)
  const byStatus: Record<string, number> = {};
  let sumMins = 0;
  let maxMins = 0;
  let softCount = 0;
  let hardCount = 0;
  let overLegacyMins = 0;
  let overCurrentCredits = 0;
  let overLegacyCredits = 0;
  let totalEstimatedCredits = 0;
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    sumMins += p.videoDurationMins;
    if (p.videoDurationMins > maxMins) maxMins = p.videoDurationMins;
    if (p.severity === "hard") hardCount += 1;
    else softCount += 1;
    if (p.exceedsLegacyLimit) overLegacyMins += 1;
    if (p.exceedsCurrentCredits) overCurrentCredits += 1;
    if (p.exceedsLegacyCredits) overLegacyCredits += 1;
    totalEstimatedCredits += p.estimatedCredits;
  }
  const summary: BypassSummary = {
    totalProjects: projects.length,
    softCount,
    hardCount,
    uniqueUsers: users.length,
    overLegacyMins,
    overCurrentCredits,
    overLegacyCredits,
    maxDurationMins: maxMins,
    avgDurationMins:
      projects.length > 0
        ? Math.round((sumMins / projects.length) * 10) / 10
        : 0,
    totalEstimatedCredits,
    byStatus,
  };

  if (view === "users") {
    const total = users.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const slice = users.slice((safePage - 1) * limit, safePage * limit);
    return {
      generatedAt: new Date(cache.at).toISOString(),
      limits: {
        currentMaxMins: FREE_MAX_MINS_CURRENT,
        legacyMaxMins: FREE_MAX_MINS_LEGACY,
        currentCredits: FREE_CREDITS_CURRENT,
        legacyCredits: FREE_CREDITS_LEGACY,
        creditsPerMin: CREDITS_PER_MIN,
      },
      view,
      threshold,
      severity,
      sort: userSort,
      sortDir,
      q: q || undefined,
      page: safePage,
      limit,
      totalPages,
      totalInView: total,
      summary,
      users: slice,
      projects: [] as BypassProjectRow[],
    };
  }

  const total = projects.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const slice = projects.slice((safePage - 1) * limit, safePage * limit);

  return {
    generatedAt: new Date(cache.at).toISOString(),
    limits: {
      currentMaxMins: FREE_MAX_MINS_CURRENT,
      legacyMaxMins: FREE_MAX_MINS_LEGACY,
      currentCredits: FREE_CREDITS_CURRENT,
      legacyCredits: FREE_CREDITS_LEGACY,
      creditsPerMin: CREDITS_PER_MIN,
    },
    view,
    threshold,
    severity,
    sort,
    sortDir,
    q: q || undefined,
    page: safePage,
    limit,
    totalPages,
    totalInView: total,
    summary,
    projects: slice,
    users: [] as BypassUserRow[],
  };
}
