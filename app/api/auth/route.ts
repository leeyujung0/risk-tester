import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function publicUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return null;
  return { id: user.id, email: user.email ?? "", name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : user.email?.split("@")[0] ?? "사용자" };
}

function clientForRequest(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  return { supabase, response };
}

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ user: null, error: "Supabase가 아직 설정되지 않았습니다." }, { status: 503 });
  const { supabase } = clientForRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ user: publicUser(user) });
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Supabase가 아직 설정되지 않았습니다." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return NextResponse.json({ error: "올바른 이메일과 8자 이상의 비밀번호를 입력해주세요." }, { status: 400 });

  const { supabase, response } = clientForRequest(req);
  const result = body.mode === "signup"
    ? await supabase.auth.signUp({ email, password, options: { data: { name: typeof body.name === "string" ? body.name.trim() : "" } } })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 401 });
  const output = NextResponse.json({ user: publicUser(result.data.user), requiresEmailConfirmation: !result.data.session });
  response.cookies.getAll().forEach((cookie) => output.cookies.set(cookie));
  return output;
}

export async function DELETE(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ user: null });
  const { supabase } = clientForRequest(req);
  await supabase.auth.signOut();
  return NextResponse.json({ user: null });
}
