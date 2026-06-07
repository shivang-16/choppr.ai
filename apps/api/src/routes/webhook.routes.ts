import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { handleDodoWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// Capture raw body BEFORE any JSON parsing so we can verify the HMAC signature.
// express.raw() stores the buffer; we convert to string and attach as req.rawBody.
router.post(
  "/dodo",
  express.raw({ type: "application/json" }),
  (req: Request, _res: Response, next: NextFunction) => {
    (req as any).rawBody = req.body.toString("utf8");
    next();
  },
  handleDodoWebhook
);

export default router;
