import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { createJob, getJob, listJobs } from "../controllers/job.controller.js";

const router = Router();

// All job routes require auth
router.use(baseAuth);

router.post("/",        createJob);   // POST   /api/jobs
router.get("/",         listJobs);    // GET    /api/jobs
router.get("/:jobId",   getJob);      // GET    /api/jobs/:jobId

export default router;
