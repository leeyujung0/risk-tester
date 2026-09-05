import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?auth_error=Google+인증이+취소되었습니다.", req.url));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[Google OAuth] Supabase 환경변수가 설정되지 않았습니다.");
    return NextResponse.redirect(new URL("/?auth_error=Google+로그인+설정을+확인해주세요.", req.url));
  }

  const successUrl = new URL("/", req.url);
  let response = NextResponse.redirect(successUrl);
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.redirect(successUrl);
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[Google OAuth] 세션 교환 실패:", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });
    const errorResponse = NextResponse.redirect(new URL("/?auth_error=Google+로그인에+실패했습니다.", req.url));
    response.cookies.getAll().forEach((cookie) => errorResponse.cookies.set(cookie));
    return errorResponse;
  }

  return response;
}
