export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMetricsAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSalesOutreach } from "@/lib/metrics";
import type { SalesSegmentId } from "@/lib/sales";

export async function GET(req: NextRequest) {
  const auth = requireMetricsAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 25);
    const segment = (sp.get("segment") || "all") as SalesSegmentId | "all";
    const fresh = sp.get("fresh") === "1";

    const data = await getSalesOutreach({ page, limit, segment, fresh });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sales";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
