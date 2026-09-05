import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Holding = { ticker: string; amount: number };

function isValidHoldings(value: unknown): value is Holding[] {
  return Array.isArray(value) && value.length <= 50 && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const holding = item as Partial<Holding>;
    return typeof holding.ticker === "string" && /^[0-9A-Z.-]{1,20}$/.test(holding.ticker)
      && typeof holding.amount === "number" && Number.isFinite(holding.amount) && holding.amount >= 0;
  });
}

async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

export async function GET() {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const portfolio = user.user_metadata?.riskTesterPortfolio;
  return NextResponse.json({ portfolio: isValidHoldings(portfolio) ? portfolio : [] });
}

export async function PUT(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isValidHoldings(body.holdings)) {
    return NextResponse.json({ error: "포트폴리오 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({
    data: { riskTesterPortfolio: body.holdings },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ portfolio: body.holdings });
}
