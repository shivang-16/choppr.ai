export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMetricsAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  getFreePlanBypasses,
  parseBypassSort,
  parseBypassSortDir,
  type BypassSeverity,
  type BypassThreshold,
  type BypassView,
} from "@/lib/bypass";
import { parseRangeFromSearchParams } from "@/lib/date-range";

function parseSeverity(v: string | null): BypassSeverity | "all" {
  if (v === "soft" || v === "hard") return v;
  return "all";
}

function parseThreshold(v: string | null): BypassThreshold {
  return v === "45" ? "45" : "30";
}

function parseView(v: string | null): BypassView {
  return v === "users" ? "users" : "projects";
}

export async function GET(req: NextRequest) {
  const auth = requireMetricsAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const data = await getFreePlanBypasses({
      page: Number(sp.get("page") ?? 1),
      limit: Number(sp.get("limit") ?? 50),
      threshold: parseThreshold(sp.get("threshold")),
      view: parseView(sp.get("view")),
      sort: parseBypassSort(sp.get("sort")),
      sortDir: parseBypassSortDir(sp.get("sortDir")),
      severity: parseSeverity(sp.get("severity")),
      q: sp.get("q") ?? undefined,
      fresh: sp.get("fresh") === "1",
      range: parseRangeFromSearchParams(sp),
    });
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load bypass report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
