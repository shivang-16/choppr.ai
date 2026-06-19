import { Request, Response, NextFunction } from "express";
import { Project } from "../model/project.model.js";
import { Clip } from "../model/clip.model.js";
import { Job } from "../model/job.model.js";
import { enqueueJob } from "../services/sqs.js";

// ── GET /api/projects ── list all projects for user ─────────────────────────
export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    const projects = await Project.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(projects);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/projects/:projectId ─────────────────────────────────────────────
export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    if (project.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    // Include real job stage + progress so the frontend can show accurate processing state
    const job = await Job.findById(project.jobId).select("status progress").lean();
    res.json({ ...project, jobStatus: job?.status ?? null, jobProgress: job?.progress ?? 0 });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/projects/:projectId/clips ───────────────────────────────────────
export async function getProjectClips(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    if (project.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const clips = await Clip.find({ projectId: req.params.projectId as string })
      .sort({ index: 1 })
      .lean();
    res.json(clips);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/projects/:projectId/retry ──────────────────────────────────────
export async function retryProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId  = (req as any).user?._id;
    const project = await Project.findById(req.params.projectId);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    if (project.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const job = await Job.findById(project.jobId);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    // Reset both project and job back to pending
    await Promise.all([
      Project.updateOne({ _id: project._id }, { $set: { status: "pending", totalClips: 0 } }),
      Job.updateOne({ _id: job._id }, { $set: { status: "pending", progress: 0, error: undefined, clips: [] } }),
    ]);

    // Re-enqueue the job — detect S3-upload source vs URL
    const isS3Upload = job.url?.startsWith("s3://");
    const s3Key = isS3Upload ? job.url.replace("s3://", "") : "";
    await enqueueJob({
      jobId:          job._id,
      projectId:      project._id as string,
      userId,
      url:            isS3Upload ? "" : (job.url ?? ""),
      s3Key,
      query:          job.query ?? "",
      clipModel:      "Auto",
      genre:          "Auto",
      clipLength:     "Auto (0m-3m)",
      aspectRatio:    (project as any).aspectRatio    ?? "9:16",
      backgroundFill: (project as any).backgroundFill ?? "blur",
      maxClips:       10,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/projects/:projectId ─────────────────────────────────────────
export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    if (project.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    await Promise.all([
      Project.deleteOne({ _id: req.params.projectId as string }),
      Clip.deleteMany({ projectId: req.params.projectId as string }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
