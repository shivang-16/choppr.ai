export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMetricsAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  getFreePlanBypasses,
  type BypassSeverity,
  type BypassSort,
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

function parseSort(v: string | null): BypassSort {
  if (
    v === "duration" ||
    v === "created" ||
    v === "credits" ||
    v === "user" ||
    v === "overLimitCount"
  ) {
    return v;
  }
  return "duration";
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
      sort: parseSort(sp.get("sort")),
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
