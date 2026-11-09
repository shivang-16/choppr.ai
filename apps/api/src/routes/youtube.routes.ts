import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import {
  disconnectYoutube,
  listYoutube,
  refreshYoutube,
  startYoutubeConnect,
  youtubeCallback,
} from "../controllers/youtube.controller.js";

const router = Router();

router.get("/callback", youtubeCallback);

router.use(baseAuth);
router.get("/", listYoutube);
router.post("/connect", startYoutubeConnect);
router.post("/refresh", refreshYoutube);
router.delete("/connections/:id", disconnectYoutube);

export default router;
