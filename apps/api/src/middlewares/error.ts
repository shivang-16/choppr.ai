import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export interface err extends Error {
  statusCode: number;
  message: string;
}

export class CustomError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    if (statusCode !== undefined) this.statusCode = statusCode;
  }
}

const errorMiddleware = (
  err: err,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  err.statusCode = err.statusCode ?? 500;
  err.message = err.message || "Internal server error";

  const meta = {
    statusCode: err.statusCode,
    method: req.method,
    path: req.originalUrl || req.path,
    body: req.method !== "GET" ? sanitizeBody(req.body) : undefined,
    query: Object.keys(req.query).length ? req.query : undefined,
    stack: err.stack,
  };

  if (err.statusCode >= 500) {
    logger.error(`Request failed: ${err.message}`, meta);
  } else {
    logger.warn(`Client error: ${err.message}`, meta);
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of ["password", "token", "secret", "authorization"]) {
    if (key in copy) copy[key] = "[redacted]";
  }
  return copy;
}

export default errorMiddleware;
