import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { getClipsByJob, getClip, getClipCaptions, translateClipCaptions, saveClipSettings } from "../controllers/clip.controller.js";

const router = Router();
router.use(baseAuth);

router.get("/",                                 getClipsByJob);
router.get("/:clipId",                          getClip);
router.get("/:clipId/captions",                 getClipCaptions);
router.get("/:clipId/captions/translate/:lang", translateClipCaptions);
router.patch("/:clipId/settings",              saveClipSettings);

export default router;
