import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase가 아직 설정되지 않았습니다." }, { status: 503 });
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, { cookies: { getAll: () => req.cookies.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: new URL("/api/auth/google/callback", req.url).toString() } });
  if (error || !data.url) return NextResponse.json({ error: error?.message ?? "Google 로그인 URL을 만들 수 없습니다." }, { status: 500 });
  const redirect = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
