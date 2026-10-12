import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger.js";
import connectDB from "../db/db.js";
import { Project } from "../model/project.model.js";
import { Clip } from "../model/clip.model.js";
import { Job } from "../model/job.model.js";
import { Export } from "../model/export.model.js";
import { BrollJob } from "../model/broll-job.model.js";
import { UsageCounter } from "../model/usage-counter.model.js";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const S3_BATCH = 1000;
const ID_BATCH = 500;
const LIFETIME_ID = "lifetime";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const mediaBucket = process.env.S3_CLIPS_BUCKET ?? process.env.S3_MEDIA_BUCKET ?? "choppr-media";
const uploadsBucket = process.env.S3_UPLOADS_BUCKET ?? mediaBucket;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function olderThanMonth(createdAt: Date, now: number) {
  return createdAt.getTime() < now - MONTH_MS;
}

/** Next Sunday 04:00 Asia/Kolkata. Returns `now` when that instant is exactly now. */
function nextSunday4amIst(now = Date.now()): number {
  const ist = new Date(now + IST_OFFSET_MS);
  const daysUntilSunday = (7 - ist.getUTCDay()) % 7;
  const sundayUtc = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate() + daysUntilSunday,
  );
  let target = sundayUtc - IST_OFFSET_MS + 4 * 60 * 60 * 1000;
  if (target < now) target += WEEK_MS;
  return target;
}

function selfCheck() {
  const now = Date.UTC(2026, 9, 12);
  if (!olderThanMonth(new Date(now - MONTH_MS - 1), now)) throw new Error("old clip must match");
  if (olderThanMonth(new Date(now - MONTH_MS), now)) throw new Error("30-day boundary must stay");
  const parts = chunk([1, 2, 3], 2);
  if (parts.length !== 2 || parts[1]!.length !== 1) throw new Error("chunk self-check failed");
  // Mon 12 Oct 2026 16:51 IST → Sun 18 Oct 2026 04:00 IST
  if (nextSunday4amIst(Date.parse("2026-10-12T11:21:00.000Z")) !== Date.parse("2026-10-17T22:30:00.000Z")) {
    throw new Error("sunday 4am schedule");
  }
  // Sun 04:30 IST waits until the following Sunday
  if (nextSunday4amIst(Date.parse("2026-10-17T23:00:00.000Z")) !== Date.parse("2026-10-24T22:30:00.000Z")) {
    throw new Error("sunday after 4am");
  }
}
selfCheck();

function ageFilter(now: number) {
  return {
    $or: [
      { createdAt: { $lt: new Date(now - MONTH_MS) } },
      { createdAt: { $exists: false } },
    ],
  };
}

async function deleteIds(model: mongoose.Model<any>, ids: string[]) {
  for (const batch of chunk(ids, ID_BATCH)) {
    await model.deleteMany({ _id: { $in: batch } });
  }
}

async function listKeysOlderThan(bucket: string, prefix: string, cutoffMs: number) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of page.Contents ?? []) {
      if (!obj.Key) continue;
      if ((obj.LastModified?.getTime() ?? 0) < cutoffMs) keys.push(obj.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function deleteKeys(bucket: string, keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))];
  for (const batch of chunk(unique, S3_BATCH)) {
    const result = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
    }));
    const fatal = (result.Errors ?? []).filter((e) => e.Code !== "NoSuchKey");
    if (fatal.length > 0) {
      throw new Error(`S3 delete ${bucket} failed: ${fatal[0]?.Code} (${fatal.length} keys)`);
    }
  }
  return unique.length;
}

/** Count what is already in Mongo once, before the first purge. Later creates increment. */
export async function ensureLifetimeCounters() {
  const existing = await UsageCounter.findById(LIFETIME_ID).select("seeded").lean();
  if (existing?.seeded) return;
  // shortcut: a create during this count can be overwritten by $set, re-seed only if this doc is deleted
  const [projects, clips] = await Promise.all([
    Project.countDocuments(),
    Clip.countDocuments(),
  ]);
  await UsageCounter.updateOne(
    { _id: LIFETIME_ID },
    { $set: { projects, clips, seeded: true } },
    { upsert: true },
  );
}

/**
 * Delete projects older than 30 days, their clips, jobs, exports, and b-roll,
 * plus the clip files, export files, b-roll images, and uploaded source videos in S3.
 * Users, credits, plans, and user assets stay.
 */
export async function purgeOldMedia(now = Date.now()) {
  await ensureLifetimeCounters();

  const projects = await Project.find(ageFilter(now)).select("_id jobId").lean();
  const projectIds = projects.map((p) => p._id as string);
  const projectJobIds = projects.map((p) => p.jobId).filter(Boolean);

  const clips = await Clip.find({
    $or: [{ projectId: { $in: projectIds } }, ageFilter(now)],
  }).select("_id s3Key").lean();

  const exports = await Export.find({
    $or: [{ projectId: { $in: projectIds } }, ageFilter(now)],
  }).select("_id s3Key").lean();

  const clipIds = clips.map((c) => c._id as string);
  const brolls = await BrollJob.find({
    $or: [{ clipId: { $in: clipIds } }, ageFilter(now)],
  }).select("_id shots.s3Key").lean();

  const jobs = await Job.find({
    $or: [
      { _id: { $in: projectJobIds } },
      { projectId: { $in: projectIds } },
      ageFilter(now),
    ],
  }).select("_id sourceVideoS3Key").lean();

  const mediaKeys = [
    ...clips.map((c) => c.s3Key),
    ...exports.map((e) => e.s3Key),
    ...brolls.flatMap((b) => (b.shots ?? []).map((s) => s.s3Key)),
  ].filter((k): k is string => !!k);
  const sourceKeys = jobs.map((j) => j.sourceVideoS3Key).filter((k): k is string => !!k);

  const cutoffMs = now - MONTH_MS;
  // DB rows only store the latest keys. Older files stay in these prefixes after a
  // project was removed earlier, so sweep anything already past 30 days.
  const [oldClips, oldExports, oldBroll, oldUploads] = await Promise.all([
    listKeysOlderThan(mediaBucket, "clips/", cutoffMs),
    listKeysOlderThan(mediaBucket, "exports/", cutoffMs),
    listKeysOlderThan(mediaBucket, "broll/", cutoffMs),
    listKeysOlderThan(uploadsBucket, "uploads/", cutoffMs),
  ]);

  const mediaDeleted = await deleteKeys(mediaBucket, [...mediaKeys, ...oldClips, ...oldExports, ...oldBroll]);
  const sourcesDeleted = await deleteKeys(uploadsBucket, [...sourceKeys, ...oldUploads]);

  await Promise.all([
    deleteIds(Project, projectIds),
    deleteIds(Clip, clipIds),
    deleteIds(Export, exports.map((e) => e._id as string)),
    deleteIds(BrollJob, brolls.map((b) => b._id as string)),
    deleteIds(Job, jobs.map((j) => j._id as string)),
  ]);

  await UsageCounter.updateOne(
    { _id: LIFETIME_ID },
    { $set: { lastCleanupAt: new Date(now) } },
  );

  const lifetime = await UsageCounter.findById(LIFETIME_ID).select("projects clips").lean();
  return {
    cutoff: new Date(now - MONTH_MS).toISOString(),
    projects: projectIds.length,
    clips: clipIds.length,
    jobs: jobs.length,
    exports: exports.length,
    brollJobs: brolls.length,
    s3MediaObjects: mediaDeleted,
    s3SourceObjects: sourcesDeleted,
    lifetimeProjects: lifetime?.projects ?? 0,
    lifetimeClips: lifetime?.clips ?? 0,
  };
}

let cleanupRunning = false;

export function startMediaCleanupSchedule() {
  const arm = () => {
    const runAt = nextSunday4amIst();
    logger.info("Media cleanup scheduled", { runAt: new Date(runAt).toISOString() });
    setTimeout(() => { void run(); }, runAt - Date.now());
  };

  const run = async () => {
    if (cleanupRunning) {
      arm();
      return;
    }
    cleanupRunning = true;
    try {
      const result = await purgeOldMedia();
      logger.info("Weekly media cleanup done", result);
    } catch (err) {
      logger.error("Weekly media cleanup failed", { error: err });
    } finally {
      cleanupRunning = false;
      arm();
    }
  };

  arm();
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  await connectDB();
  try {
    const result = await purgeOldMedia();
    logger.info("Old media purge finished", result);
  } finally {
    await mongoose.disconnect();
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    logger.error("Old media purge failed", { error: err });
    process.exit(1);
  });
}
