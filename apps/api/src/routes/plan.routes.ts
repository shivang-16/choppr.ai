import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { listPlans, myPlan } from "../controllers/plan.controller.js";

const router = Router();

router.get("/",    listPlans);         // public — no auth
router.get("/me",  baseAuth, myPlan);  // auth required

export default router;
