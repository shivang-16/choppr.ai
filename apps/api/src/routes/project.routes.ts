import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import {
  listProjects,
  getProject,
  getProjectClips,
  deleteProject,
} from "../controllers/project.controller.js";

const router = Router();
router.use(baseAuth);

router.get("/",                          listProjects);
router.get("/:projectId",                getProject);
router.get("/:projectId/clips",          getProjectClips);
router.delete("/:projectId",             deleteProject);

export default router;
