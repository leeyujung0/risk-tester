import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

function parseMaxLossTolerance(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) return undefined;
  return value;
}

export async function GET() {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const stored = parseMaxLossTolerance(user.user_metadata?.maxLossTolerancePct);
  return NextResponse.json({ maxLossTolerancePct: stored ?? null });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const maxLossTolerancePct = parseMaxLossTolerance(body.maxLossTolerancePct);
  if (maxLossTolerancePct === undefined) {
    return NextResponse.json({ error: "손실 허용 범위는 0보다 크고 100 이하인 숫자여야 합니다." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ data: { maxLossTolerancePct } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ maxLossTolerancePct });
}
