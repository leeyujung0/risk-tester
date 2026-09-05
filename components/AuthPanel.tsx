"use client";

import { useState } from "react";
import { AuthModal, type AuthUser } from "@/components/AuthModal";

type AuthPanelProps = {
  user?: AuthUser | null;
  onHome?: () => void;
  onAuth?: (mode: "login" | "signup") => void;
  onLogout?: () => void;
  initialMode?: "login" | "signup";
  initialOpen?: boolean;
};

export function AuthPanel({ user = null, onHome, onAuth, onLogout, initialMode = "login", initialOpen = false }: AuthPanelProps) {
  const [standaloneMode, setStandaloneMode] = useState<"login" | "signup" | null>(initialOpen ? initialMode : null);
  const openAuth = (mode: "login" | "signup") => onAuth ? onAuth(mode) : setStandaloneMode(mode);
  return (
    <>
      <div className="app-header-auth">
        <button onClick={() => onHome ? onHome() : window.scrollTo({ top: 0, behavior: "smooth" })}>홈</button>
        {user ? <><span>{user.name}님</span><button className="app-header-login" onClick={onLogout}>로그아웃</button></> : <><button onClick={() => openAuth("signup")}>회원가입</button><button onClick={() => openAuth("login")} className="app-header-login">로그인</button></>}
      </div>
      {standaloneMode && <AuthModal mode={standaloneMode} onClose={() => setStandaloneMode(null)} onAuthenticated={() => window.location.assign("/")} />}
    </>
  );
}
