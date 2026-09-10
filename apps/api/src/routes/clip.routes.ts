import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { getClipsByJob, getClip, getClipEdits, getClipCaptions, translateClipCaptions, saveClipSettings } from "../controllers/clip.controller.js";
import { suggestBroll, generateBroll, getClipBroll } from "../controllers/broll.controller.js";

const router = Router();
router.use(baseAuth);

router.get("/",                                 getClipsByJob);
router.get("/:clipId",                          getClip);
router.get("/:clipId/edits",                    getClipEdits);
router.get("/:clipId/captions",                 getClipCaptions);
router.get("/:clipId/captions/translate/:lang", translateClipCaptions);
router.patch("/:clipId/settings",              saveClipSettings);
router.get("/:clipId/broll",                   getClipBroll);
router.post("/:clipId/broll/suggest",          suggestBroll);
router.post("/:clipId/broll/generate",         generateBroll);

export default router;
