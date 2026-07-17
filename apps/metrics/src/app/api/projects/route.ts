export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireMetricsAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getProjectsMetrics } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  const auth = requireMetricsAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await connectDB();
    const data = await getProjectsMetrics();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
