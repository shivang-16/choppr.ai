export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkLogin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const result = checkLogin(body.username, body.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, username: body.username });
}
