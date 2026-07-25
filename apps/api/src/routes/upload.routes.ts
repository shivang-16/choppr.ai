import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { presignUpload, probeUpload } from "../controllers/upload.controller.js";

const router = Router();

router.use(baseAuth);

router.post("/presign", presignUpload);
router.post("/probe",   probeUpload);

export default router;
