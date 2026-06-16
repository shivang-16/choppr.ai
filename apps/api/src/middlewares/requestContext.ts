import { NextFunction, Request, Response } from "express";
import {
  createRequestId,
  mergeRequestContext,
  runWithRequestContext,
  type RequestLogContext,
} from "../utils/requestContext.js";

/**
 * Attaches a per-request log context (requestId, method, path).
 * User email/id are added later by baseAuth once the user is resolved.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? createRequestId();

  res.setHeader("x-request-id", requestId);

  runWithRequestContext(
    {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    },
    () => next(),
  );
}

export function attachUserToRequestContext(req: Request): void {
  const user = req.user as { _id?: string; email?: string } | undefined;
  if (!user) return;

  const patch: Partial<RequestLogContext> = {};
  if (user._id) patch.userId = user._id;
  if (user.email) patch.userEmail = user.email;
  mergeRequestContext(patch);
}
