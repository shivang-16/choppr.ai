import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { presignUpload } from "../controllers/upload.controller.js";

const router = Router();

router.use(baseAuth);

router.post("/presign", presignUpload);

export default router;
