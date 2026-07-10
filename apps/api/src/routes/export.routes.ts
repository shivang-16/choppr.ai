import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { createExport, getExport, cancelExport } from "../controllers/export.controller.js";

const router = Router();

router.use(baseAuth);

router.post("/",                    createExport);  // POST   /api/exports
router.get("/:exportId",            getExport);     // GET    /api/exports/:exportId
router.post("/:exportId/cancel",    cancelExport);  // POST   /api/exports/:exportId/cancel

export default router;
