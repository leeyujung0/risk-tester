"use client";

import Image from "next/image";
import { AppHeader } from "@/components/AppHeader";
import type { AuthUser } from "@/components/AuthModal";

export function LandingPage({ onStart, onHome, user, onAuth, onLogout }: { onStart: () => void; onHome?: () => void; user: AuthUser | null; onAuth: (mode: "login" | "signup") => void; onLogout: () => void }) {
  return (
    <main className="landing-shell">
      <AppHeader variant="landing" user={user} onHome={onHome} onAuth={onAuth} onLogout={onLogout} />
      <section className="landing-hero">
        <div className="landing-copy">
          <h1 className="landing-title">
            <span className="text-[#eb3636]">Risk</span>{" "}
            <span className="text-black/40">Tester</span>
          </h1>
          <p className="landing-description">
            “수익률만 보고 매수하셨나요?”
            <br />
            보유 종목을 입력하면 몬테카를로 시뮬레이션으로 거시경제 위기 시
            <br />
            예상 손실을 예상하고, AI가 눈높이에 맞게 해설해드려요.
          </p>
          <button onClick={onStart} className="landing-start-button">
            <span className="landing-start-button-label">내 포트폴리오 입력하러 가기</span>
          </button>
        </div>
        <div className="landing-visual">
          <div className="landing-visual-image">
            <Image src="/stock-market-hero.png" alt="Risk Tester 금융 시뮬레이션 일러스트" fill priority sizes="706px" className="object-cover" />
          </div>
        </div>
      </section>
    </main>
  );
}
