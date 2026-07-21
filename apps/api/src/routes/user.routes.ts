import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { getMyPopups, updatePopup } from "../controllers/user.controller.js";

const router = Router();

router.use(baseAuth);

router.get("/me/popups", getMyPopups);
router.patch("/me/popups/:key", updatePopup);

export default router;
