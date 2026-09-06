"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, X } from "lucide-react";
import { LossHistogram } from "@/components/LossHistogram";
import { RiskGauge } from "@/components/RiskGauge";
import { LandingPage } from "@/components/LandingPage";
import { InvestmentDisclaimer } from "@/components/InvestmentDisclaimer";
import { AuthModal, type AuthUser } from "@/components/AuthModal";
import { AppHeader } from "@/components/AppHeader";
import { FX_PRESETS, RATE_PRESETS, describeFxIntensity, describeRateIntensity } from "@/lib/engine/historicalPresets";
import { HORIZON_OPTIONS } from "@/lib/engine/horizon";
import type { SimulationResult, StressScenario } from "@/lib/engine/types";
import { scaleImpactContributions } from "@/lib/impactScale";
import { evaluateRiskTolerance } from "@/lib/riskTolerance";
import { LEGOLAND_2022_BACKTEST } from "@/lib/engine/backtest";

type View = "home" | "input" | "result";
type Holding = { ticker: string; amount: number };
type ReportLevel = "beginner" | "intermediate";
type Preset = { id: string; label: string; note: string; value: number };
type SimulationPayload = { scenario: StressScenario; result: SimulationResult; baselineVar: number; additionalVarLossPp: number; estimatedTickers: string[] };
type CompanyRisk = { ticker: string; name: string; riskCategory: string; severity: "낮음" | "중간" | "높음"; rationale: string; sourceDate: string | null; pending: boolean };

const STOCKS = [["005930", "삼성전자"], ["000660", "SK하이닉스"], ["035420", "NAVER"], ["035720", "카카오"], ["005380", "현대차"], ["051910", "LG화학"], ["105560", "KB금융"], ["055550", "신한지주"], ["035900", "JYP Ent."], ["017670", "SK텔레콤"]] as const;
const STOCK_TAGS = [
  ["035720", "카카오"], ["005490", "포스코"], ["055550", "신한지주"], ["005380", "현대차"], ["017670", "SK텔레콤"], ["012450", "한화에어로"], ["105560", "KB금융"],
  ["000660", "SK하이닉스"], ["035420", "NAVER"], ["035900", "JYP Ent."], ["051910", "LG화학"], ["000270", "기아"], ["006400", "삼성SDI"], ["352820", "하이브"],
  ["009150", "삼성전기"], ["068270", "셀트리온"], ["207940", "삼성바이오로직스"], ["034020", "두산에너빌리티"], ["012330", "현대모비스"], ["096770", "SK이노베이션"], ["030200", "KT"], ["010130", "고려아연"],
] as const;
const STOCK_NAME = new Map<string, string>([...STOCKS, ...STOCK_TAGS]);
const BRAND_CARD_COLORS: Record<string, string> = {
  "삼성전자": "#E9EDF5",
  NAVER: "#EAF2EC",
  "KB금융": "#F4F1E7",
  "카카오": "#F6F1DE",
  "SK하이닉스": "#F4EAED",
  "신한지주": "#EAF0F3",
  "현대차": "#E9EFF3",
  "LG화학": "#F0EDF4",
  "JYP Ent.": "#F5EEEA",
  "SK텔레콤": "#F4ECEE",
};
const BRAND_CARD_COLORS_BY_TICKER: Record<string, string> = {
  "005930": "#E7F0FA", "035420": "#EAF7DF", "105560": "#FFF8D9",
  "035720": "#F8E7CF", "005490": "#EEF1F0", "055550": "#EAF0F3", "005380": "#E9EFF3",
  "017670": "#F4ECE3", "012450": "#F5EFEB", "373220": "#EEF5EC", "000660": "#F4EAED",
  "035900": "#F5EEEA", "051910": "#F0EDF4", "000270": "#EDF1F3", "006400": "#EBEEF3",
  "352820": "#F1EDF2", "009150": "#ECEFF4", "068270": "#EDF3EF", "207940": "#EEF2EF",
  "034020": "#F2EFEA", "012330": "#EDF1F3", "096770": "#F1ECEE", "030200": "#F2EFF2", "010130": "#F3F1E9",
};
const PORTFOLIO_LABELS: Record<string, string> = {
  "005930": "삼성전자(반도체/IT)", "000660": "SK하이닉스(반도체/IT)",
  "035420": "NAVER(플랫폼/성장주)", "035720": "카카오(플랫폼/성장주)",
  "005490": "포스코(철강)", "055550": "신한지주(금융)", "105560": "KB금융(금융)",
  "005380": "현대차(자동차)", "000270": "기아(자동차)", "012330": "현대모비스(자동차부품)",
  "017670": "SK텔레콤(통신)", "030200": "KT(통신)",
  "012450": "한화에어로(방산/항공)", "035900": "JYP Ent.(엔터)", "352820": "하이브(엔터)",
  "051910": "LG화학(화학)", "006400": "삼성SDI(배터리)", "373220": "LG에너지(배터리)",
  "009150": "삼성전기(전자부품)", "068270": "셀트리온(바이오)", "207940": "삼성바이오로직스(바이오)",
  "034020": "두산에너빌리티(에너지)", "096770": "SK이노베이션(에너지)", "010130": "고려아연(비철금속)",
};
const AI_BRAND_COLORS: Record<string, string> = {};

function getBrandCardColor(name: string, ticker: string): string {
  const mappedColor = BRAND_CARD_COLORS_BY_TICKER[ticker] ?? BRAND_CARD_COLORS[name] ?? AI_BRAND_COLORS[ticker];
  if (mappedColor) return mappedColor;

  // 새 종목도 이름/티커를 해시해 동일한 파스텔 색을 재현합니다.
  const seed = `${name}${ticker}`;
  const hash = [...seed].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
  return `hsl(${hash % 360} 22% 93%)`;
}
const INITIAL_HOLDINGS: Holding[] = [{ ticker: "005930", amount: 4_000_000 }, { ticker: "035420", amount: 2_000_000 }, { ticker: "105560", amount: 2_000_000 }];
const RISK_TOLERANCE_SESSION_KEY = "riskTesterMaxLossTolerancePct";
const fxPresets: Preset[] = FX_PRESETS.map((item) => ({ ...item, value: item.fxShockPct }));
const ratePresets: Preset[] = RATE_PRESETS.map((item) => ({ ...item, value: item.rateShockPp }));
const money = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function RiskTesterApp({ initialView = "home" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView), [auth, setAuth] = useState<"login" | "signup" | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_HOLDINGS), [fx, setFx] = useState(8), [rate, setRate] = useState(0.5), [horizonId, setHorizonId] = useState("1m");
  const [simulation, setSimulation] = useState<SimulationPayload | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<Record<string, string>>({});
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [riskTolerancePct, setRiskTolerancePct] = useState<number | null>(null);
  const horizon = HORIZON_OPTIONS.find((item) => item.id === horizonId) ?? HORIZON_OPTIONS[0];
  const total = useMemo(() => holdings.reduce((sum, item) => sum + item.amount, 0), [holdings]);
  const add = (ticker: string) => { setHoldings((items) => items.some((item) => item.ticker === ticker) ? items : [...items, { ticker, amount: 1_000_000 }]); if (BRAND_CARD_COLORS_BY_TICKER[ticker] || BRAND_CARD_COLORS[STOCK_NAME.get(ticker) ?? ""]) return; fetch("/api/brand-color", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.color) { AI_BRAND_COLORS[ticker] = data.color; setBrandColors((colors) => ({ ...colors, [ticker]: data.color })); } }).catch(() => undefined); };
  const remove = (ticker: string) => setHoldings((items) => items.filter((item) => item.ticker !== ticker));
  const updateAmount = (ticker: string, amount: number) => setHoldings((items) => items.map((item) => item.ticker === ticker ? { ...item, amount: Math.max(0, amount) } : item));
  const loadUserData = useCallback(async () => {
    try {
      const [portfolioResponse, riskResponse] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/risk-profile"),
      ]);
      const [portfolioData, riskData] = await Promise.all([portfolioResponse.json(), riskResponse.json()]);
      if (!portfolioResponse.ok) throw new Error(portfolioData.error ?? "저장된 포트폴리오를 불러오지 못했습니다.");
      if (!riskResponse.ok) throw new Error(riskData.error ?? "손실 허용 범위를 불러오지 못했습니다.");
      if (Array.isArray(portfolioData.portfolio)) setHoldings(portfolioData.portfolio);
      setRiskTolerancePct(typeof riskData.maxLossTolerancePct === "number" ? riskData.maxLossTolerancePct : null);
      setStorageNotice(null);
    } catch (cause) {
      setStorageNotice(cause instanceof Error ? cause.message : "저장된 사용자 정보를 불러오지 못했습니다.");
    }
  }, []);
  useEffect(() => {
    const sessionValue = Number(window.sessionStorage.getItem(RISK_TOLERANCE_SESSION_KEY));
    if (Number.isFinite(sessionValue) && sessionValue > 0 && sessionValue <= 100) setRiskTolerancePct(sessionValue);
    void fetch("/api/auth")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const authenticatedUser = data?.user ?? null;
        setUser(authenticatedUser);
        if (authenticatedUser) void loadUserData();
      })
      .catch(() => undefined);
  }, [loadUserData]);
  const handleAuthenticated = (authenticatedUser: AuthUser) => {
    setUser(authenticatedUser);
    void loadUserData();
  };
  async function savePortfolio(items: Holding[]) {
    try {
      const response = await fetch("/api/portfolio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ holdings: items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "포트폴리오를 저장하지 못했습니다.");
      setStorageNotice(null);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "포트폴리오를 저장하지 못했습니다.";
      setStorageNotice(`시뮬레이션은 실행했지만 저장에 실패했습니다. ${detail}`);
    }
  }
  function updateRiskTolerance(value: number) {
    setRiskTolerancePct(value);
    if (!user) {
      window.sessionStorage.setItem(RISK_TOLERANCE_SESSION_KEY, String(value));
      return;
    }
    void fetch("/api/risk-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxLossTolerancePct: value }) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "손실 허용 범위를 저장하지 못했습니다.");
        setStorageNotice(null);
      })
      .catch((cause) => setStorageNotice(cause instanceof Error ? cause.message : "손실 허용 범위를 저장하지 못했습니다."));
  }
  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setUser(null);
    const sessionValue = Number(window.sessionStorage.getItem(RISK_TOLERANCE_SESSION_KEY));
    setRiskTolerancePct(Number.isFinite(sessionValue) && sessionValue > 0 && sessionValue <= 100 ? sessionValue : null);
  }
  async function run() {
    if (!holdings.length || total <= 0) return setError("투자 금액이 있는 종목을 한 개 이상 추가해 주세요.");
    setLoading(true); setError(null); setSimulation(null);
    if (user) void savePortfolio(holdings);
    try {
      const response = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ holdings: holdings.map(({ ticker, amount }) => ({ ticker, weight: amount })), fxShockPct: fx, rateShockPp: rate, horizonDays: horizon.horizonDays }) });
      const data = await response.json() as SimulationPayload | { error?: string };
      if (!response.ok || !("result" in data)) throw new Error(("error" in data ? data.error : undefined) ?? "시뮬레이션을 실행하지 못했습니다.");
      setSimulation(data); setView("result"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "시뮬레이션 중 오류가 발생했습니다."); } finally { setLoading(false); }
  }
  if (view === "home") {
    return <div className="bg-white text-black"><LandingPage user={user} onStart={() => setView("input")} onHome={() => setView("home")} onAuth={setAuth} onLogout={logout} />{auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onAuthenticated={handleAuthenticated} />}</div>;
  }

  if (view === "input") {
    return <div className="bg-white text-black"><Input holdings={holdings} total={total} fx={fx} rate={rate} horizonId={horizonId} riskTolerancePct={riskTolerancePct} loading={loading} error={error} user={user} brandColors={brandColors} onHome={() => setView("home")} onAuth={setAuth} onLogout={logout} onAdd={add} onRemove={remove} onAmount={updateAmount} onFx={setFx} onRate={setRate} onHorizon={setHorizonId} onRiskTolerance={updateRiskTolerance} onRun={run} />{storageNotice && <p role="status" className="fixed right-6 bottom-6 z-50 max-w-[520px] rounded-xl bg-amber-50 px-5 py-4 text-[16px] text-amber-800 shadow-lg">{storageNotice}</p>}{auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onAuthenticated={handleAuthenticated} />}</div>;
  }

  return <div className="bg-white text-black">{view === "result" && simulation && <ResultsFigma simulation={simulation} horizonLabel={horizon.label} riskTolerancePct={riskTolerancePct} user={user} onBack={() => setView("input")} onHome={() => setView("home")} onAuth={setAuth} onLogout={logout} />}{storageNotice && <p role="status" className="fixed right-6 bottom-6 z-50 max-w-[520px] rounded-xl bg-amber-50 px-5 py-4 text-[16px] text-amber-800 shadow-lg">{storageNotice}</p>}{auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onAuthenticated={handleAuthenticated} />}</div>;
}

type InputProps = { holdings: Holding[]; total: number; fx: number; rate: number; horizonId: string; riskTolerancePct: number | null; loading: boolean; error: string | null; user: AuthUser | null; brandColors: Record<string, string>; onHome: () => void; onAuth: (mode: "login" | "signup") => void; onLogout: () => void; onAdd: (ticker: string) => void; onRemove: (ticker: string) => void; onAmount: (ticker: string, amount: number) => void; onFx: (value: number) => void; onRate: (value: number) => void; onHorizon: (value: string) => void; onRiskTolerance: (value: number) => void; onRun: () => void };
function Input(p: InputProps) {
  const [ticker, setTicker] = useState("");
  const [tagOffset, setTagOffset] = useState(0);
  const toleranceValue = p.riskTolerancePct ?? 10;
  const tags = [["005930", "삼성전자"], ["035720", "카카오"], ["005490", "포스코"], ["055550", "신한지주"], ["005380", "현대차"], ["017670", "SK텔레콤"], ["012450", "한화에어로"], ["105560", "KB금융"], ["068270", "셀트리온"], ["373220", "LG에너지"], ["000660", "SK하이닉스"], ["035420", "NAVER"], ["035900", "JYP Ent."], ["051910", "LG화학"], ["000270", "기아"], ["006400", "삼성SDI"], ["352820", "하이브"]] as const;
  const availableTags = tags.filter(([code]) => !p.holdings.some((item) => item.ticker === code));
  const topRowTags = availableTags.filter((_, index) => index % 2 === 0);
  const bottomRowTags = availableTags.filter((_, index) => index % 2 === 1);
  useEffect(() => { setTagOffset((offset) => availableTags.length < 9 ? 0 : Math.max(-440, Math.min(157, offset))); }, [availableTags.length]);
  const addTicker = () => { const code = ticker.trim().toUpperCase(); if (code) { p.onAdd(code); setTicker(""); } };
  const tagButtonClass = "input-stock-tag box-border flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-[32px] border-2 border-black px-[28px] font-['Inter'] font-medium leading-[29px] text-black";
  const presetClass = "input-preset-large flex h-[64px] w-fit items-center whitespace-nowrap rounded-[40px] border-2 border-[#DADADA] bg-white/80 px-[28px] py-[11px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

  return <main className="mx-auto min-h-[2765px] w-[1440px] overflow-hidden bg-white font-['Inter'] text-black">
    <AppHeader variant="input" user={p.user} onHome={p.onHome} onAuth={p.onAuth} onLogout={p.onLogout} />

    <section className="mx-[80px] mt-[80px]">
      <h1 className="h-[58px] w-[624px] font-['Inter'] text-[48px] font-semibold leading-[58px] tracking-[-0.02em]">내 포트폴리오</h1>
      <p className="mt-[34px] flex h-[64px] w-[844px] items-center font-['Roboto'] text-[24px] font-medium leading-[32px] text-black/75">보유 종목별 투자 금액(원)을 입력하세요. 입력한 금액의 합계를 기준으로 비중(%)이 자동으로 계산됩니다.</p>

      <div className="mt-[32px] grid grid-cols-3 gap-x-[82px] gap-y-[32px] px-[24px]">
        {p.holdings.map((item) => {
          const stockName = STOCK_NAME.get(item.ticker) ?? item.ticker;
          const cardColor = BRAND_CARD_COLORS_BY_TICKER[item.ticker] ?? BRAND_CARD_COLORS[stockName] ?? p.brandColors[item.ticker] ?? getBrandCardColor(stockName, item.ticker);
          return <label key={item.ticker} className="box-border flex h-[121px] w-[355px] flex-col justify-center rounded-[30px] px-[24px]" style={{ backgroundColor: cardColor }}>
            <span className="flex items-center justify-between text-[24px] font-medium leading-[36px]">{PORTFOLIO_LABELS[item.ticker] ?? `${stockName}(기타)`}<button type="button" aria-label={`${stockName} 삭제`} className="ml-[8px] h-[28px] w-[28px] text-[22px] font-normal leading-[24px]" onClick={() => p.onRemove(item.ticker)}>×</button></span>
            <span className="input-holding-amount flex h-[38px] w-full items-center gap-[4px] text-[#828282]"><span aria-hidden="true">₩</span><input aria-label={`${item.ticker} 투자 금액`} className="min-w-0 flex-1 bg-transparent text-[#828282] outline-none" type="text" inputMode="numeric" value={Math.round(item.amount).toLocaleString("ko-KR")} onChange={(event) => p.onAmount(item.ticker, Number(event.target.value.replace(/[^0-9]/g, "")))} /></span>
          </label>;
        })}
      </div>

      <div className="mt-[42px] flex h-[36px] items-center pl-[24px] text-[24px] leading-[36px]"><strong className="w-[178px] font-medium">총 투자금액</strong><span className="font-normal text-[#828282]">{Math.round(p.total).toLocaleString("ko-KR")} 원</span></div>
    </section>

    <section className="mt-[119px] flex w-full items-center gap-[18px] px-[66px]">
      <button className="flex h-[67px] w-[67px] shrink-0 items-center justify-center rounded-full border border-black/75 bg-white" aria-label="이전 종목" onClick={() => setTagOffset((offset) => Math.min(offset + 220, 157))}><ChevronLeft className="h-[30px] w-[30px] stroke-[1px]" /></button>
      <div
        className="min-w-0 flex-1 overflow-hidden py-[10px]"
        style={{
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.18) 0%, #000 32%, #000 68%, rgba(0,0,0,0.18) 100%)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,0.18) 0%, #000 32%, #000 68%, rgba(0,0,0,0.18) 100%)",
        }}
      >
        <div className="flex flex-col gap-[83px] transition-transform duration-300 ease-out" style={{ transform: `translateX(${tagOffset}px)` }}>
          <div className="flex h-[52px] w-max items-center gap-[30px]">{topRowTags.map(([code, name]) => <button className={tagButtonClass} key={code} style={{ fontSize: "24px" }} onClick={() => p.onAdd(code)}>+ {name}</button>)}</div>
          <div className="flex h-[52px] w-max items-center gap-[30px] pl-[65px]">{bottomRowTags.map(([code, name]) => <button className={tagButtonClass} key={code} style={{ fontSize: "24px" }} onClick={() => p.onAdd(code)}>+ {name}</button>)}</div>
        </div>
      </div>
      <button className="flex h-[67px] w-[67px] shrink-0 items-center justify-center rounded-full border border-black/75 bg-white" aria-label="다음 종목" onClick={() => setTagOffset((offset) => Math.max(offset - 220, -440))}><ChevronRight className="h-[30px] w-[30px] stroke-[1px]" /></button>
    </section>

    <div className="mr-[91px] mt-[75px] ml-auto flex h-[71px] w-[473px] items-center rounded-[30px] bg-[rgba(159,159,159,0.13)] px-[23px] text-[24px] leading-[36px]"><strong className="w-[120px] shrink-0 font-medium">직접 입력:</strong><input className="min-w-0 flex-1 bg-transparent outline-none" value={ticker} onChange={(event) => setTicker(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTicker(); }} /><button className="font-medium" onClick={addTicker}>추가</button></div>

    <section className="mx-[80px] mt-[126px]">
      <h2 className="h-[116px] w-[624px] text-[48px] font-semibold leading-[58px] tracking-[-0.02em]">충격 시나리오를 직접<br />조정해보세요.</h2>
      <div className="mt-[42px] grid grid-cols-2 gap-[81px]">
        <section className="flex w-[599px] flex-col justify-between gap-[32px] rounded-[30px] bg-[rgba(213,213,213,0.23)] px-[20px] py-[16px]">
          <div className="min-h-[164px]">
          <h3 className="h-[48px] text-[32px] font-medium leading-[48px]">환율 충격 시나리오</h3>
          <p className="mt-[8px] w-full text-[24px] font-normal leading-[36px] text-[#828282]">환율이 얼마까지 오르는 상황을 가정할까요? 판단의 재료는 과거 사례로 드릴게요, 최종 강도는 직접 정해주세요.</p>
          </div>
          <div className="flex w-full flex-col items-start gap-[24px]">{fxPresets.map((preset) => <button className={`${presetClass} ${p.fx === preset.value ? "border-[#5C67FD] bg-[rgba(92,103,253,0.11)]" : ""}`} key={preset.id} onClick={() => p.onFx(preset.value)}>{preset.label}</button>)}</div>
          <div className="w-full">
            <input aria-label="환율 충격 강도" className="input-scenario-range h-[18px] w-full" style={{ background: `linear-gradient(to right, #5C67FD 0%, #5C67FD ${((p.fx + 10) / 160) * 100}%, #E3E3E3 ${((p.fx + 10) / 160) * 100}%, #E3E3E3 100%)` }} type="range" min="-10" max="150" step="1" value={p.fx} onChange={(event) => p.onFx(Number(event.target.value))} />
            <div className="mt-[24px] flex w-full justify-between text-[24px] font-medium leading-[36px]"><span>-10%</span><span>+{p.fx}%</span><span>+150%</span></div>
          </div>
          <aside className="flex min-h-[100px] w-full items-center justify-center rounded-[20px] bg-[rgba(92,103,253,0.11)] px-[20px] text-center text-[24px] font-medium leading-[36px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">💡{describeFxIntensity(p.fx)}</aside>
        </section>
        <section className="flex w-[599px] flex-col justify-between gap-[32px] rounded-[30px] bg-[rgba(213,213,213,0.23)] px-[20px] py-[16px]">
          <div className="min-h-[164px]">
          <h3 className="h-[48px] text-[32px] font-medium leading-[48px]">금리 충격 시나리오</h3>
          <p className="mt-[8px] w-full text-[24px] font-normal leading-[36px] text-[#828282]">기준금리가 얼마나 오르는 상황을 가정할까요?</p>
          </div>
          <div className="flex w-full flex-col items-start gap-[24px]">{ratePresets.map((preset) => <button className={`${presetClass} ${p.rate === preset.value ? "border-[#5C67FD] bg-[rgba(92,103,253,0.11)]" : ""}`} key={preset.id} onClick={() => p.onRate(preset.value)}>{preset.label}</button>)}</div>
          <div className="w-full">
            <input aria-label="금리 충격 강도" className="input-scenario-range h-[18px] w-full" style={{ background: `linear-gradient(to right, #5C67FD 0%, #5C67FD ${((p.rate + 2) / 18) * 100}%, #E3E3E3 ${((p.rate + 2) / 18) * 100}%, #E3E3E3 100%)` }} type="range" min="-2" max="16" step="0.05" value={p.rate} onChange={(event) => p.onRate(Number(event.target.value))} />
            <div className="mt-[24px] flex w-full justify-between text-[24px] font-medium leading-[36px]"><span>-2.00%p</span><span>+{p.rate.toFixed(2)}%p</span><span>+16.00%p</span></div>
          </div>
          <aside className="flex min-h-[100px] w-full items-center justify-center rounded-[20px] bg-[rgba(92,103,253,0.11)] px-[20px] text-center text-[24px] font-medium leading-[36px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">💡{describeRateIntensity(p.rate)}</aside>
        </section>
      </div>
    </section>

    <section className="mx-[81px] mt-[120px]">
      <h2 className="text-[32px] font-medium leading-[48px]">감당 가능한 최대 손실은?</h2>
      <p className="mt-[8px] text-[24px] leading-[36px] text-[#828282]">내가 버틸 수 있는 포트폴리오 손실 한도를 설정해 주세요.</p>
      <div className="mt-[28px] flex gap-[24px]">{[10, 15, 20, 30].map((value) => <button type="button" className="input-risk-preset h-[64px] w-[150px] rounded-[22px] border-2 border-[#DADADA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]" key={value} aria-pressed={p.riskTolerancePct === value} onClick={() => p.onRiskTolerance(value)}>-{value}%</button>)}</div>
      <div className="mt-[32px] flex w-[700px] items-center gap-[24px]">
        <input aria-label="감당 가능한 최대 손실" className={`input-scenario-range h-[18px] flex-1 ${p.riskTolerancePct === null ? "opacity-50" : ""}`} style={{ background: `linear-gradient(to right, #5C67FD 0%, #5C67FD ${((toleranceValue - 5) / 45) * 100}%, #E3E3E3 ${((toleranceValue - 5) / 45) * 100}%, #E3E3E3 100%)` }} type="range" min="5" max="50" step="1" value={toleranceValue} onChange={(event) => p.onRiskTolerance(Number(event.target.value))} />
        <strong className="w-[130px] text-[28px] font-medium">{p.riskTolerancePct === null ? "미설정" : `-${p.riskTolerancePct}%`}</strong>
      </div>
    </section>

    <section className="mx-[81px] mt-[120px]"><h2 className="h-[48px] w-[515px] text-[32px] font-medium leading-[48px]">시뮬레이션 기간</h2><p className="mt-[14px] h-[36px] w-[515px] text-[24px] font-normal leading-[36px] text-[#828282]">얼마나 먼 미래까지의 위험을 볼까요?</p><div className="mt-[30px] flex gap-[46px]">{HORIZON_OPTIONS.slice(0, 3).map((item) => <button className="input-horizon-large h-[70px] w-[194px] rounded-[24px] border-2 border-[#DADADA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] aria-pressed:border-[#5C67FD] aria-pressed:bg-[rgba(92,103,253,0.11)]" key={item.id} aria-pressed={p.horizonId === item.id} onClick={() => p.onHorizon(item.id)}>{item.label}</button>)}</div></section>
    {p.error && <p role="alert" className="mx-[84px] mt-[32px] text-[18px] text-red-600">{p.error}</p>}
    <button disabled={p.loading} onClick={p.onRun} className="input-run-large mx-[84px] mb-[120px] mt-[87px] flex h-[76px] w-[1264px] items-center justify-center gap-[8px] rounded-[20px] bg-[#5C67FD] px-[32px] py-[20px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] disabled:opacity-70">{p.loading && <LoaderCircle className="animate-spin" size={24} />}{p.loading ? "스트레스 테스트 실행 중…" : "스트레스 테스트 실행"}</button>
  </main>;
}

function TagCarousel({ selected, onAdd }: { selected: Set<string>; onAdd: (ticker: string) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [directOpen, setDirectOpen] = useState(false);
  const [directTicker, setDirectTicker] = useState("");
  const [tagTone, setTagTone] = useState<Record<string, number>>({});
  const availableTags = STOCK_TAGS.filter(([ticker]) => !selected.has(ticker));
  const splitIndex = Math.ceil(availableTags.length / 2);
  const rows = [availableTags.slice(0, splitIndex), availableTags.slice(splitIndex)];
  const scrollBy = (left: number) => viewportRef.current?.scrollBy({ left, behavior: "smooth" });
  function updateTagTone() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const nextTone: Record<string, number> = {};
    viewport.querySelectorAll<HTMLButtonElement>("[data-stock-tag]").forEach((tag) => {
      const rect = tag.getBoundingClientRect();
      const distance = Math.abs((rect.left + rect.width / 2) - viewportCenter);
      nextTone[tag.dataset.stockTag ?? ""] = Math.max(0.12, 1 - distance / (viewportRect.width * 0.58));
    });
    setTagTone(nextTone);
  }
  useEffect(() => { updateTagTone(); window.addEventListener("resize", updateTagTone); return () => window.removeEventListener("resize", updateTagTone); }, []);
  function addDirectTicker(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const ticker = directTicker.trim().toUpperCase(); if (!ticker) return; onAdd(ticker); setDirectTicker(""); setDirectOpen(false); }
  return <div className="space-y-5"><div className="flex items-center gap-3"><button type="button" aria-label="이전 종목" onClick={() => scrollBy(-300)} className="z-10 shrink-0 rounded-full border border-slate-300 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"><ChevronLeft size={18} /></button><div ref={viewportRef} onScroll={updateTagTone} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("[data-stock-tag]")) return; dragRef.current = { active: true, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragRef.current.active) event.currentTarget.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX); }} onPointerUp={() => { dragRef.current.active = false; }} onPointerCancel={() => { dragRef.current.active = false; }} className="scrollbar-none flex-1 cursor-grab overflow-x-auto active:cursor-grabbing"><div className="w-max space-y-3 py-2"><div className="flex gap-3 pl-10">{rows[0].map(([ticker, name]) => <Tag key={ticker} ticker={ticker} name={name} tone={tagTone[ticker] ?? 0.12} onAdd={onAdd} />)}</div><div className="flex gap-3 pr-10">{rows[1].map(([ticker, name]) => <Tag key={ticker} ticker={ticker} name={name} tone={tagTone[ticker] ?? 0.12} onAdd={onAdd} />)}</div></div></div><button type="button" aria-label="다음 종목" onClick={() => scrollBy(300)} className="z-10 shrink-0 rounded-full border border-slate-300 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"><ChevronRight size={18} /></button></div><div className="flex justify-end">{directOpen ? <form onSubmit={addDirectTicker} className="flex w-full max-w-sm items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2"><input autoFocus value={directTicker} onChange={(event) => setDirectTicker(event.target.value)} placeholder="종목 코드 입력" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button type="submit" className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">추가</button><button type="button" onClick={() => setDirectOpen(false)} className="px-1 text-slate-400"><X size={16} /></button></form> : <button type="button" onClick={() => setDirectOpen(true)} className="w-full max-w-sm rounded-2xl bg-slate-100 px-5 py-3 text-left text-sm font-semibold text-slate-700">직접 입력:</button>}</div></div>;
}

function Tag({ ticker, name, tone, onAdd }: { ticker: string; name: string; tone: number; onAdd: (ticker: string) => void }) {
  const textLightness = 12 + (1 - tone) * 60;
  const borderLightness = 18 + (1 - tone) * 62;
  return <button type="button" data-stock-tag={ticker} onClick={(event) => { event.stopPropagation(); onAdd(ticker); }} style={{ color: `hsl(0 0% ${textLightness}%)`, borderColor: `hsl(0 0% ${borderLightness}%)` }} className="whitespace-nowrap rounded-full border bg-white px-4 py-2 text-xs font-semibold transition-colors duration-150"><Plus className="mr-1 inline" size={13} />{name}</button>;
}

function HoldingCard({ item, total, onAmount, onRemove }: { item: Holding; total: number; onAmount: (ticker: string, amount: number) => void; onRemove: (ticker: string) => void }) { const name = STOCK_NAME.get(item.ticker) ?? item.ticker; return <div style={{ backgroundColor: getBrandCardColor(name, item.ticker) }} className="rounded-2xl border border-white/70 p-5"><div className="flex items-start justify-between"><p className="font-bold">{name}</p><button onClick={() => onRemove(item.ticker)} aria-label="종목 삭제" className="text-slate-400 hover:text-red-500"><X size={16} /></button></div><p className="mt-1 text-xs text-slate-500">{item.ticker} · 비중 {total ? ((item.amount / total) * 100).toFixed(1) : "0.0"}%</p><label className="mt-4 block text-xs font-medium text-slate-600">투자 금액<input type="number" min="0" step="100000" value={item.amount} onChange={(event) => onAmount(item.ticker, Number(event.target.value))} className="mt-1 w-full rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-base font-bold outline-none focus:border-indigo-500" /></label></div>; }
function Shock({ title, value, min, max, step, unit, presets, description, onChange }: { title: string; value: number; min: number; max: number; step: number; unit: string; presets: Preset[]; description: string; onChange: (value: number) => void }) { return <div className="space-y-2"><div className="min-h-[300px] rounded-[14px] bg-[#f5f5f5] p-[10px]"><h3 className="text-[14px] font-bold leading-5">{title}</h3><p className="mt-1 min-h-10 text-[11px] leading-4 text-slate-400">{title.startsWith("환율") ? "환율이 얼마나 오르는 상황을 가정할까요? 판단의 재료로 과거 사례를 드릴게요. 최종 강도는 직접 조절하세요." : "기준금리가 얼마나 오르는 상황을 가정할까요?"}</p><div className="mt-2 flex flex-col items-start gap-2">{presets.map((preset) => <button key={preset.id} onClick={() => onChange(preset.value)} className={`rounded-full border px-3 py-1 text-[12px] font-medium leading-4 ${value === preset.value ? "border-slate-200 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-900"}`}>{preset.label}</button>)}</div><div className="mt-4"><input aria-label={title} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="scenario-range h-1 w-full cursor-pointer accent-[#5C67FD]" /><div className="mt-3 flex justify-between text-[11px] font-semibold text-slate-900"><span>{min}{unit}</span><span>{value >= 0 ? "+" : ""}{unit === "%p" ? value.toFixed(2) : value}{unit}</span><span>+{max}{unit}</span></div></div></div><p className="min-h-10 rounded-[10px] bg-[#eef0ff] px-3 py-3 text-[10px] font-medium leading-4 text-slate-900">💡 {description}</p></div>; }

type ResultsFigmaProps = { simulation: SimulationPayload; horizonLabel: string; riskTolerancePct: number | null; user: AuthUser | null; onBack: () => void; onHome: () => void; onAuth: (mode: "login" | "signup") => void; onLogout: () => void };
function ResultsFigma({ simulation, horizonLabel, riskTolerancePct, user, onBack, onHome, onAuth, onLogout }: ResultsFigmaProps) {
  const [level, setLevel] = useState<ReportLevel>("beginner");
  const [report, setReport] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [companyRisks, setCompanyRisks] = useState<CompanyRisk[]>([]);
  async function reportRequest() {
    setReportLoading(true); setReportError(null);
    try {
      const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: simulation.scenario, result: simulation.result, level }) });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "AI 리포트를 생성하지 못했습니다.");
      setReport(text);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "AI 리포트 생성 중 오류가 발생했습니다.");
      setReport("");
    }
    finally { setReportLoading(false); }
  }
  const { scenario, result, additionalVarLossPp } = simulation;
  const fxLabel = `${scenario.fxShockPct >= 0 ? "+" : ""}${scenario.fxShockPct}%`;
  const rateLabel = `${scenario.rateShockPp >= 0 ? "+" : ""}${scenario.rateShockPp.toFixed(2)}%p`;
  const impactRows = scaleImpactContributions(result.assetContribution);
  const impactExtraHeight = Math.max(0, impactRows.length - 3) * 62;
  const companyRiskExtraHeight = 190 + Math.max(1, Math.ceil(result.assetContribution.length / 3)) * 170;
  const toleranceExtraHeight = riskTolerancePct === null ? 0 : 104;
  const toleranceEvaluation = riskTolerancePct === null ? null : evaluateRiskTolerance(result.var, riskTolerancePct);
  const best = [...result.assetContribution].sort((a, b) => b.contributionPp - a.contributionPp)[0];
  const worst = [...result.assetContribution].sort((a, b) => a.contributionPp - b.contributionPp)[0];
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/company-risk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers: result.assetContribution.map((asset) => asset.ticker) }), signal: controller.signal })
      .then((response) => response.ok ? response.json() : { risks: [] })
      .then((data) => setCompanyRisks(Array.isArray(data.risks) ? data.risks : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [result.assetContribution]);
  if (report !== null) return <AiReportFigma report={report} error={reportError} user={user} onHome={onHome} onAuth={onAuth} onLogout={onLogout} />;
  return <main className="result-figma-shell" style={{ "--impact-extra-height": `${impactExtraHeight}px`, "--tolerance-extra-height": `${toleranceExtraHeight}px`, "--company-risk-extra-height": `${companyRiskExtraHeight}px`, "--backtest-extra-height": "440px" } as React.CSSProperties}>
    <AppHeader variant="result" user={user} onHome={onHome} onAuth={onAuth} onLogout={onLogout} />
    <button className="result-figma-back" onClick={onBack}>← 조건 다시 입력하기</button>
    <section className="result-figma-heading"><h1>환율 {fxLabel} · 금리 {rateLabel}&nbsp;시나리오 결과</h1><p>{horizonLabel} 기준, {result.finalReturns.length.toLocaleString("ko-KR")}회 몬테카를로 시뮬레이션</p></section>
    {simulation.estimatedTickers.length > 0 && <div className="result-data-fallback-warning" role="status">실시간 데이터 조회 실패, 참고용 추정치 사용 ({simulation.estimatedTickers.map((ticker) => STOCK_NAME.get(ticker) ?? ticker).join(", ")})</div>}
    <section className="result-figma-gauge"><GaugeGraphic value={result.var} /></section>
    <section className="result-figma-metrics">{[["CVaR (극단 손실 평균)", pct(result.cvar)], ["평균 MDD", pct(result.expectedMDD)], ["최악 MDD (5%tile)", pct(result.worstMDD)], ["중앙값 수익률", pct(result.medianReturn)]].map(([label, value], index) => <article key={label}><span>{label}</span><strong className={index === 3 ? "positive" : ""}>{value}</strong></article>)}</section>
    <div className="result-figma-banner">평시(충격 없음) 대비, 이 시나리오로 인한 추가 손실은 약&nbsp;<em>{additionalVarLossPp.toFixed(2)}%p</em>예요.</div>
    {toleranceEvaluation && riskTolerancePct !== null && <div className={`result-tolerance-banner ${toleranceEvaluation.isWithinTolerance ? "safe" : "warning"}`}>{toleranceEvaluation.isWithinTolerance ? <>예상 손실은 당신의 허용 범위(-{riskTolerancePct}%) 안에 있어요.</> : <>당신의 허용 범위(-{riskTolerancePct}%)를 <strong>{toleranceEvaluation.exceededByPp.toFixed(2)}%p</strong> 초과했어요.</>}</div>}
    <h2 className="result-figma-cause-title">왜 이런 결과가 나왔을까요?</h2>
    <section className="result-figma-cause"><p>원/달러 환율이 {Math.abs(scenario.fxShockPct)}% 약세(환율 상승) 방향으로 움직이는 상황을 가정했어요. 환율이 오르면 해외 매출 비중이 큰 수출주는 원화로 환산한 이익이 늘어 유리해지고, 원자재·부품을 수입에 의존하는 내수 업종은 비용 부담이 커져 불리해지는 경향이 있어요. 기준금리는 {scenario.rateShockPp.toFixed(2)}%p 인상을 가정했어요. 금리가 오르면 먼 미래의 이익을 지금 가치로 할인해서 평가하는 성장주는 밸류에이션 부담이 커지고, 은행 등 금융주는 예대마진이 확대돼 상대적으로 유리해지는 경향이 있어요. 이번 포트폴리오에서는 {worst?.name ?? "하락 종목"}이(가) {worst ? `${worst.contributionPp.toFixed(2)}%p` : "-"}로 가장 큰 타격을 받고, {best?.name ?? "상승 종목"}은(는) {best ? `${best.contributionPp >= 0 ? "+" : ""}${best.contributionPp.toFixed(2)}%p` : "-"}로 상대적으로 선방할 것으로 추정돼요.</p><img src="/figma-result-mascot.png" alt="결과를 분석하는 3D 캐릭터" /></section>
    <section className="result-figma-distribution"><h2>손실 분포</h2><p>{result.finalReturns.length.toLocaleString("ko-KR")}개의 시뮬레이션 경로가 만든 예상 수익률 분포예요</p><HistogramGraphic returns={result.finalReturns} /></section>
    <section className="result-figma-impact"><h2>종목별 영향도</h2><p>이 시나리오가 실현되면 어떤 종목이 포트폴리오를 얼마나 움직일까요</p><div className="result-impact-list">{impactRows.map((asset) => <div className="result-impact-row" key={asset.ticker}><span>{asset.name}</span><div className="result-impact-track"><i className={asset.contributionPp >= 0 ? "gain" : "loss"} style={{ width: `${asset.barWidth}px` }} /></div><b>{asset.contributionPp >= 0 ? "+" : ""}{asset.contributionPp.toFixed(2)}pp</b></div>)}</div></section>
    <section className="result-company-risk"><h2>기업 리스크</h2><p>최근 공시를 바탕으로 확인한 종목별 주요 위험이에요.</p><div>{companyRisks.length > 0 ? companyRisks.map((risk) => <article className={`severity-${risk.severity}`} key={risk.ticker}><header><strong>{STOCK_NAME.get(risk.ticker) ?? risk.name}</strong><span>{risk.pending ? "준비 중" : `${risk.riskCategory} · ${risk.severity}`}</span></header><p>{risk.pending ? "공시 리스크 정보 준비 중" : risk.riskCategory === "없음" ? "특이사항 없음" : risk.rationale}</p>{risk.sourceDate && <small>기준일 {risk.sourceDate}</small>}</article>) : <p className="result-company-risk-loading">공시 리스크 정보를 불러오는 중…</p>}</div></section>
    <BacktestValidation />
    <section className="result-figma-report"><h2>AI 맞춤 해설 리포트</h2><p>위 계산 결과를 바탕으로, 눈높이에 맞는 설명을 생성해요</p><div className="result-report-controls"><span>설명 수준:</span><button className={level === "beginner" ? "active" : ""} onClick={() => { setLevel("beginner"); setReport(null); }}>초보자</button><button className={level === "intermediate" ? "active" : ""} onClick={() => { setLevel("intermediate"); setReport(null); }}>중급자</button><button className="generate" disabled={reportLoading} onClick={reportRequest}>{reportLoading ? "생성 중…" : "AI 리포트 생성"}</button></div><p className="result-report-hint">버튼을 눌러 이 시나리오에 대한 AI 해설을 받아보세요.</p>{reportError && <div className="result-report-error">{reportError}</div>}{report && <div className="result-report-output">{report}</div>}</section>
    <InvestmentDisclaimer className="result-figma-footer" />
  </main>;
}

function BacktestValidation() {
  const item = LEGOLAND_2022_BACKTEST;
  const maxAbs = Math.max(Math.abs(item.predictedMedianReturnPct), Math.abs(item.actualReturnPct), 1);
  const bars = [
    { label: "모델 예측", value: item.predictedMedianReturnPct, tone: "predicted" },
    { label: "실제 수익률", value: item.actualReturnPct, tone: "actual" },
  ];
  return <section className="result-backtest"><h2>모델 검증</h2><p>{item.title} 당시 동일 포트폴리오의 예측과 실제 결과를 비교했어요.</p><div className="result-backtest-chart">{bars.map((bar) => <div className="result-backtest-row" key={bar.label}><span>{bar.label}</span><div><i className={bar.tone} style={{ width: `${Math.abs(bar.value) / maxAbs * 100}%` }} /></div><strong>{bar.value >= 0 ? "+" : ""}{bar.value.toFixed(2)}%</strong></div>)}</div><p className="result-backtest-error">예측 오차 <strong>{item.errorPp.toFixed(2)}%p</strong> · 오차율 {item.errorRatePct.toFixed(2)}%</p><small>{item.period} · {item.asOf}<br /><a href={item.sourceUrl} target="_blank" rel="noreferrer">출처: {item.source}</a> · 환율 {item.fxShockPct}% / 기준금리 +{item.rateShockPp}%p</small></section>;
}

function AiReportFigma({ report, error, user, onHome, onAuth, onLogout }: { report: string; error: string | null; user: AuthUser | null; onHome: () => void; onAuth: (mode: "login" | "signup") => void; onLogout: () => void }) {
  return <main className="ai-report-figma-shell">
    <AppHeader variant="report" user={user} onHome={onHome} onAuth={onAuth} onLogout={onLogout} />
    <h1>AI 맞춤 해설 리포트</h1>
    <img className="ai-report-figma-sparkle" src="/figma-ai-report-sparkle.png" alt="" />
    <section className="ai-report-figma-bubble"><img src="/figma-ai-report-bubble.svg" alt="" />{error ? <p className="ai-report-figma-error" role="alert">AI 리포트 생성 중 오류가 발생했습니다.<br /><span>{error}</span></p> : <p>{report}</p>}</section>
    <div className="ai-report-figma-tail"><img src="/figma-ai-report-tail.svg" alt="" /></div>
    <img className="ai-report-figma-avatar" src="/figma-ai-report-avatar.png" alt="AI 해설 캐릭터" />
    <InvestmentDisclaimer className="ai-report-figma-footer" />
  </main>;
}

function GaugeGraphic({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(1, Math.abs(value) / .3));
  const angle = Math.PI - normalized * Math.PI;
  const needleX = 219 + Math.cos(angle) * 145;
  const needleY = 233 - Math.sin(angle) * 145;
  const risk = value > -.08 ? { label: "안전 구간", color: "#16A34A", bg: "#E7F7EC" } : value > -.15 ? { label: "주의 구간", color: "#D79B00", bg: "#FFF5D6" } : { label: "위험 구간", color: "#E24646", bg: "#FDE8E8" };
  return <svg viewBox="0 0 437 398" role="img" aria-label="95% VaR 마이너스 20.3퍼센트, 위험 구간">
    <path d="M55 232 A165 165 0 0 1 126 96" fill="none" stroke="#3DBB74" strokeWidth="34" strokeLinecap="round" />
    <path d="M126 96 A165 165 0 0 1 292 94" fill="none" stroke="#F4C74B" strokeWidth="34" />
    <path d="M292 94 A165 165 0 0 1 382 232" fill="none" stroke="#E24646" strokeWidth="34" strokeLinecap="round" />
    <line x1="219" y1="233" x2={needleX} y2={needleY} stroke={risk.color} strokeWidth="8" strokeLinecap="round" /><circle cx="219" cy="233" r="17" fill={risk.color} />
    <text x="219" y="301" textAnchor="middle" className="gauge-value" fill={risk.color}>{(value * 100).toFixed(1)}%</text><text x="219" y="337" textAnchor="middle" className="gauge-label">95% VaR</text>
    <rect x="154" y="351" width="130" height="42" rx="21" fill={risk.bg}/><text x="219" y="379" textAnchor="middle" className="gauge-badge" fill={risk.color}>{risk.label}</text>
  </svg>;
}

function HistogramGraphic({ returns }: { returns: number[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const binCount = 28;
  const min = Math.min(...returns), max = Math.max(...returns), step = (max - min) / binCount || .01;
  const bars = Array.from({ length: binCount }, () => 0);
  returns.forEach((value) => { bars[Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / step)))] += 1; });
  const peak = Math.max(...bars, 1);
  const zeroX = 42 + Math.max(0, Math.min(binCount, (0 - min) / step)) * 37;
  const hoveredHeight = hoveredIndex === null ? 0 : bars[hoveredIndex] / peak * 316;
  const tooltipLeft = hoveredIndex === null ? 0 : Math.max(0, Math.min(857, 42 + hoveredIndex * 37 - 127));
  const tooltipTop = Math.max(8, 360 - hoveredHeight - 96);
  return <div className="result-histogram" onMouseLeave={() => setHoveredIndex(null)}><svg viewBox="0 0 1142 411" role="img" aria-label="손실과 수익 분포 히스토그램">{bars.map((count, index) => { const height = count / peak * 316; const x = 42 + index * 37; const loss = min + (index + .5) * step < 0; return <rect className="result-hist-bar" key={x} x={x} y={360-height} width="31" height={height} rx="3" fill={loss ? "#E24646" : "#16A34A"} opacity={hoveredIndex === null || hoveredIndex === index ? 0.82 : 0.55} tabIndex={0} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} />; })}<line x1={zeroX} y1="32" x2={zeroX} y2="366" stroke="#111" strokeDasharray="7 7"/><line x1="38" y1="366" x2="1105" y2="366" stroke="#9A9A9A"/><text x={zeroX} y="397" textAnchor="middle" className="hist-zero">0%</text></svg>{hoveredIndex !== null && <div className="result-hist-tooltip" style={{ left: tooltipLeft, top: tooltipTop }}><b>수익률 구간: {((min + hoveredIndex * step) * 100).toFixed(1)}% ~ {((min + (hoveredIndex + 1) * step) * 100).toFixed(1)}%</b><span>시뮬레이션 횟수 : {bars[hoveredIndex].toLocaleString("ko-KR")}회</span></div>}</div>;
}
