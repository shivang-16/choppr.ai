import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import {
  listProjects,
  getProject,
  getProjectClips,
  deleteProject,
  retryProject,
} from "../controllers/project.controller.js";

const router = Router();
router.use(baseAuth);

router.get("/",                          listProjects);
router.get("/:projectId",                getProject);
router.get("/:projectId/clips",          getProjectClips);
router.post("/:projectId/retry",         retryProject);
router.delete("/:projectId",             deleteProject);

export default router;
