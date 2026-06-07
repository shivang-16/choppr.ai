import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { createCheckout } from "../controllers/payment.controller.js";

const router = Router();

// POST /api/payments/checkout — create a Dodo subscription checkout session
router.post("/checkout", baseAuth, createCheckout);

export default router;
