import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { getClipCaptions, translateClipCaptions } from "../controllers/clip.controller.js";

const router = Router();
router.use(baseAuth);

router.get("/:clipId/captions",                 getClipCaptions);
router.get("/:clipId/captions/translate/:lang", translateClipCaptions);

export default router;
