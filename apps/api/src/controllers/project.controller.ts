import { Request, Response, NextFunction } from "express";
import { Project } from "../model/project.model.js";
import { Clip } from "../model/clip.model.js";

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
    res.json(project);
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
