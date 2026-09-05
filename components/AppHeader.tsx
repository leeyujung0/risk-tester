"use client";

import { AuthPanel } from "@/components/AuthPanel";
import type { AuthUser } from "@/components/AuthModal";

type AppHeaderProps = {
  variant: "landing" | "input" | "result" | "report";
  user: AuthUser | null;
  onHome?: () => void;
  onAuth: (mode: "login" | "signup") => void;
  onLogout: () => void;
};

export function AppHeader({ variant, user, onHome, onAuth, onLogout }: AppHeaderProps) {
  return <header className={`app-header app-header-${variant}`}>
    <button type="button" className="app-header-brand" onClick={onHome}>@Risk_Tester</button>
    <AuthPanel user={user} onHome={onHome} onAuth={onAuth} onLogout={onLogout} />
  </header>;
}
