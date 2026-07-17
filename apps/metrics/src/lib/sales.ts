/**
 * Sales / outreach segments derived from product usage.
 * Each user gets one primary segment (highest priority match).
 */

export type UserMetricsRow = {
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  plan: string;
  subscriptionStatus: string;
  isOnboarded: boolean;
  signedUpAt?: Date | string;
  totalCredits: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
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
  lastVisitedAt: Date | string | null;
  visitCount: number;
  topupCount?: number;
  topupCredits?: number;
};

export type SalesSegmentId =
  | "stuck_failures"
  | "upgrade_ready"
  | "low_credits"
  | "no_export"
  | "churn_risk"
  | "never_started"
  | "new_hot"
  | "paid_champion"
  | "topup_upsell";

export type SalesLead = UserMetricsRow & {
  segment: SalesSegmentId;
  priority: number;
  label: string;
  reason: string;
  suggestedMessage: string;
};

const SEGMENT_META: Record<
  SalesSegmentId,
  { label: string; priority: number }
> = {
  stuck_failures: { label: "Stuck / failures", priority: 1 },
  upgrade_ready: { label: "Upgrade ready", priority: 2 },
  low_credits: { label: "Low credits", priority: 3 },
  topup_upsell: { label: "Top-up → plan", priority: 4 },
  no_export: { label: "Never exported", priority: 5 },
  churn_risk: { label: "Churn risk", priority: 6 },
  new_hot: { label: "New & active", priority: 7 },
  never_started: { label: "Never started", priority: 8 },
  paid_champion: { label: "Paid champion", priority: 9 },
};

function daysSince(d: Date | string | null | undefined) {
  if (!d) return Infinity;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function firstName(u: UserMetricsRow) {
  return u.firstName?.trim() || u.username || "there";
}

function isPaid(u: UserMetricsRow) {
  return (
    u.plan !== "free" ||
    u.subscriptionStatus === "active"
  );
}

function isFreeish(u: UserMetricsRow) {
  return u.plan === "free" || u.subscriptionStatus === "free";
}

function messageFor(segment: SalesSegmentId, u: UserMetricsRow): string {
  const name = firstName(u);
  switch (segment) {
    case "stuck_failures":
      return `Hey ${name} — noticed a few of your Choppr projects failed. Want me to jump in and help get a clip exported today? Reply with a link and I’ll take a look.`;
    case "upgrade_ready":
      return `Hey ${name} — you’ve already made ${u.projectCount} project${u.projectCount === 1 ? "" : "s"} and ${u.exportDoneCount} export${u.exportDoneCount === 1 ? "" : "s"} on free. Core unlocks more credits + higher limits if you’re clipping regularly. Want a quick walkthrough?`;
    case "low_credits":
      return `Hey ${name} — looks like you’re low on credits after solid usage. Happy to point you at a top-up or a plan that matches your volume so you don’t get blocked mid-edit.`;
    case "topup_upsell":
      return `Hey ${name} — you’ve bought top-ups (${u.topupCount ?? 0}×). If you’re topping up often, a monthly plan is usually cheaper per credit. Want a side-by-side for your usage?`;
    case "no_export":
      return `Hey ${name} — you’ve got clips ready in Choppr but haven’t exported yet. Export is where the short-form magic lands — I can send a 60-sec walkthrough if useful.`;
    case "churn_risk":
      return `Hey ${name} — you were clipping with Choppr before and it’s been a bit quiet. Anything we can improve, or want help finishing a video this week?`;
    case "never_started":
      return `Hey ${name} — welcome to Choppr! Drop any YouTube/long video URL and we’ll cut shorts for you. Stuck on signup or first project? I can help in 2 mins.`;
    case "new_hot":
      return `Hey ${name} — awesome start on Choppr already. If you tell me your niche (podcast, gaming, faceless, etc.) I can share settings that work best for exports.`;
    case "paid_champion":
      return `Hey ${name} — thanks for being on ${u.plan}. You’re one of our power users (${u.projectCount} projects / ${u.exportDoneCount} exports). Would you be open to a short feedback call or a case-study shoutout?`;
  }
}

function reasonFor(segment: SalesSegmentId, u: UserMetricsRow): string {
  switch (segment) {
    case "stuck_failures":
      return `${u.projectsByStatus.failed} failed vs ${u.projectsByStatus.done} done — needs support`;
    case "upgrade_ready":
      return `Free/core heavy user: ${u.projectCount} projects, ${u.exportDoneCount} exports, ${u.lifetimeSpent} credits spent`;
    case "low_credits":
      return `${u.totalCredits} credits left, spent ${u.lifetimeSpent} lifetime — risk of hitting a wall`;
    case "topup_upsell":
      return `${u.topupCount} top-up purchases (${u.topupCredits} credits) — plan likely better value`;
    case "no_export":
      return `${u.clipCount} clips / ${u.projectsByStatus.done} done projects, 0 successful exports`;
    case "churn_risk":
      return `Last active ${Math.floor(daysSince(u.lastVisitedAt))}d ago after ${u.projectCount} projects`;
    case "never_started":
      return `Signed up ${Math.floor(daysSince(u.signedUpAt))}d ago, 0 projects`;
    case "new_hot":
      return `Joined ${Math.floor(daysSince(u.signedUpAt))}d ago, already ${u.projectCount} projects`;
    case "paid_champion":
      return `Paid ${u.plan}: ${u.projectCount} projects, ${u.exportDoneCount} exports`;
  }
}

/** Assign highest-priority segment, or null if no outreach needed. */
export function assignSegment(u: UserMetricsRow): SalesSegmentId | null {
  const signedDays = daysSince(u.signedUpAt);
  const idleDays = daysSince(u.lastVisitedAt);
  const failed = u.projectsByStatus.failed;
  const done = u.projectsByStatus.done;
  const freeish = isFreeish(u);
  const paid = isPaid(u);

  if (failed >= 2 && failed >= done) return "stuck_failures";

  if (
    freeish &&
    (u.projectCount >= 3 || u.exportDoneCount >= 2 || u.lifetimeSpent >= 20)
  ) {
    return "upgrade_ready";
  }

  if (
    u.totalCredits <= 5 &&
    u.lifetimeSpent > 0 &&
    idleDays <= 21
  ) {
    return "low_credits";
  }

  if ((u.topupCount ?? 0) >= 1 && freeish) return "topup_upsell";

  if (
    (u.clipCount >= 1 || done >= 1) &&
    u.exportDoneCount === 0
  ) {
    return "no_export";
  }

  if (u.projectCount >= 1 && idleDays >= 14 && idleDays < 180) {
    return "churn_risk";
  }

  if (signedDays <= 7 && u.projectCount >= 1) return "new_hot";

  if (u.projectCount === 0 && signedDays >= 2) return "never_started";

  if (
    paid &&
    u.plan !== "free" &&
    (u.projectCount >= 5 || u.exportDoneCount >= 3)
  ) {
    return "paid_champion";
  }

  return null;
}

export function buildSalesLeads(users: UserMetricsRow[]): {
  summary: Record<SalesSegmentId, number>;
  leads: SalesLead[];
  bySegment: Record<SalesSegmentId, SalesLead[]>;
} {
  const summary = Object.fromEntries(
    (Object.keys(SEGMENT_META) as SalesSegmentId[]).map((k) => [k, 0])
  ) as Record<SalesSegmentId, number>;

  const bySegment = Object.fromEntries(
    (Object.keys(SEGMENT_META) as SalesSegmentId[]).map((k) => [k, [] as SalesLead[]])
  ) as Record<SalesSegmentId, SalesLead[]>;

  const leads: SalesLead[] = [];

  for (const u of users) {
    const segment = assignSegment(u);
    if (!segment) continue;

    const meta = SEGMENT_META[segment];
    const lead: SalesLead = {
      ...u,
      segment,
      priority: meta.priority,
      label: meta.label,
      reason: reasonFor(segment, u),
      suggestedMessage: messageFor(segment, u),
    };

    summary[segment] += 1;
    bySegment[segment].push(lead);
    leads.push(lead);
  }

  leads.sort((a, b) => a.priority - b.priority || b.visitCount - a.visitCount);

  for (const key of Object.keys(bySegment) as SalesSegmentId[]) {
    bySegment[key].sort((a, b) => b.visitCount - a.visitCount);
  }

  return { summary, leads, bySegment };
}

export const SEGMENT_ORDER = (
  Object.entries(SEGMENT_META) as [SalesSegmentId, { label: string; priority: number }][]
)
  .sort((a, b) => a[1].priority - b[1].priority)
  .map(([id, meta]) => ({ id, label: meta.label, priority: meta.priority }));
