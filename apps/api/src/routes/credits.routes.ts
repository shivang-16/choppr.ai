import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import {
  getCredits,
  deductJob,
  refundJob,
  topupCredits,
} from "../controllers/credits.controller.js";

const router = Router();

// User-facing — requires Clerk auth
router.get("/", baseAuth, getCredits);

// Internal endpoints — secured by x-internal-secret header, no Clerk auth needed
router.post("/deduct-job",  deductJob);
router.post("/refund-job",  refundJob);
router.post("/topup",       topupCredits);

export default router;
