import { Router } from "express";
import { baseAuth } from "../middlewares/checkAuth.js";
import { createCheckout, createTopupCheckout, listTopupPacks } from "../controllers/payment.controller.js";

const router = Router();

// POST /api/payments/checkout — create a Dodo subscription checkout session
router.post("/checkout", baseAuth, createCheckout);

// GET  /api/payments/topup-packs — list all active credit top-up packs
router.get("/topup-packs", baseAuth, listTopupPacks);

// POST /api/payments/topup-checkout — create a Dodo one-time topup checkout session
router.post("/topup-checkout", baseAuth, createTopupCheckout);

export default router;
