"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";

export type AuthUser = { id: string; name: string; email: string };

type AuthModalProps = {
  mode: "login" | "signup";
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
};

export function AuthModal({ mode, onClose, onAuthenticated }: AuthModalProps) {
  const [activeMode, setActiveMode] = useState(mode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: activeMode, name: form.get("name"), email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "인증 처리 중 오류가 발생했습니다.");
      if (data.requiresEmailConfirmation) {
        setMessage("가입 확인 이메일을 보냈습니다. 이메일을 확인한 뒤 로그인해 주세요.");
        return;
      }
      onAuthenticated(data.user);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "인증 처리 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const isSignup = activeMode === "signup";
  const switchMode = (nextMode: "login" | "signup") => {
    setActiveMode(nextMode);
    setError("");
    setMessage("");
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="relative w-full max-w-[568px] rounded-[16px] border border-slate-300 bg-white px-[40px] pb-[28px] pt-[38px] shadow-[0_16px_40px_rgb(15_23_42_/_0.12)]"><button onClick={onClose} aria-label="닫기" className="absolute right-[38px] top-[56px] text-slate-800 transition hover:opacity-60"><X size={28} strokeWidth={1} /></button><h2 className="text-[34px] font-bold leading-none tracking-[-0.06em]">{isSignup ? "회원가입" : "로그인"}</h2><p className="mt-3 text-[16px] text-slate-500">Risk Tester 계정으로 시작하세요.</p><div className="mt-7 grid h-[56px] grid-cols-2 rounded-[8px] bg-[#eef0ff] p-[6px] text-[17px] font-medium"><button type="button" onClick={() => switchMode("login")} className={`rounded-[8px] transition ${!isSignup ? "bg-white font-bold text-[#5c67fd] shadow-[0_2px_3px_rgb(15_23_42_/_0.22)]" : "text-slate-600"}`}>로그인</button><button type="button" onClick={() => switchMode("signup")} className={`rounded-[8px] transition ${isSignup ? "bg-white font-bold text-[#5c67fd] shadow-[0_2px_3px_rgb(15_23_42_/_0.22)]" : "text-slate-600"}`}>회원가입</button></div><form onSubmit={submit} className={isSignup ? "mt-6 space-y-4" : "mt-6 space-y-5"}>{isSignup && <label className="block text-[17px] font-medium text-slate-700">이름<input name="name" required minLength={2} placeholder="홍길동" className="mt-2 h-[48px] w-full rounded-[14px] border border-slate-300 px-4 text-[17px] font-normal placeholder:text-slate-400 outline-none focus:border-[#5c67fd]" /></label>}<label className="block text-[17px] font-medium text-slate-700">이메일<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="mt-2 h-[48px] w-full rounded-[14px] border border-slate-300 px-4 text-[17px] font-normal placeholder:text-slate-400 outline-none focus:border-[#5c67fd]" /></label><label className="block text-[17px] font-medium text-slate-700">비밀번호<input name="password" type="password" required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="8자 이상" className="mt-2 h-[48px] w-full rounded-[14px] border border-slate-300 px-4 text-[17px] font-normal placeholder:text-slate-400 outline-none focus:border-[#5c67fd]" /></label>{error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}<button disabled={pending} className="mt-1 h-[48px] w-full rounded-[8px] bg-[#5c67fd] text-[18px] font-bold text-white shadow-[0_3px_3px_rgb(15_23_42_/_0.18)] hover:bg-[#4e58e8] disabled:opacity-60">{pending ? "처리 중…" : isSignup ? "계정 만들기" : "로그인"}</button></form><div className="my-7 flex items-center justify-center text-[16px] text-slate-400">또는</div><button type="button" onClick={() => window.location.assign("/api/auth/google")} className="h-[48px] w-full rounded-[14px] border border-slate-300 text-[17px] font-medium text-slate-400 transition hover:bg-slate-50"><span className="font-semibold text-[#4f6dff]">G</span><span className="font-semibold text-[#e94436]">o</span><span className="font-semibold text-[#f7b529]">o</span><span className="font-semibold text-[#4f6dff]">g</span><span className="font-semibold text-[#2da75a]">l</span><span className="font-semibold text-[#e94436]">e</span>로 계속하기</button></div></div>;
}
