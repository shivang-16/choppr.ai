import { NextRequest } from "next/server";

export function checkLogin(username?: string, password?: string) {
  const expectedUser = process.env.METRICS_USERNAME;
  const expectedPass = process.env.METRICS_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return { ok: false as const, status: 503, error: "Metrics auth not configured" };
  }

  if (username === expectedUser && password === expectedPass) {
    return { ok: true as const };
  }

  return { ok: false as const, status: 401, error: "Invalid username or password" };
}

export function requireMetricsAuth(req: NextRequest) {
  const expectedUser = process.env.METRICS_USERNAME;
  const expectedPass = process.env.METRICS_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return { ok: false as const, status: 503, error: "Metrics auth not configured" };
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      const user = sep >= 0 ? decoded.slice(0, sep) : "";
      const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
      if (user === expectedUser && pass === expectedPass) {
        return { ok: true as const };
      }
    } catch {
      // fall through
    }
  }

  return { ok: false as const, status: 401, error: "Unauthorized" };
}
