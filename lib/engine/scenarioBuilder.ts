import { StressScenario } from "./types";

export interface CustomShockInput {
  fxShockPct: number; // 원/달러 환율 충격 (%)
  rateShockPp: number; // 기준금리 충격 (%p)
}

/**
 * 사용자가 슬라이더로 고른 환율/금리 충격 크기로부터 변동성 배수(volMultiplier)와
 * 상관계수 상승분(correlationBump)까지 포함한 완전한 시나리오를 만든다.
 *
 * 근거: 충격 강도와 변동성·상관계수 사이의 정확한 함수 관계는 상황마다 다르고
 * 실제로는 과거 위기 국면별로 실현 변동성/상관계수를 추정해야 정확하다.
 * MVP 단계에서는 "충격이 클수록 시장 전체가 더 출렁이고, 자산들이 같은 방향으로
 * 더 강하게 움직인다"는 정성적 관계만 단순 선형식으로 반영한다.
 * (Day 4~5에서 과거 위기 국면의 실현 변동성/상관계수 실측치 기반으로 교체 예정)
 *
 * 스케일 기준:
 *  - fxIntensity = 1.0  → 환율 +100% (1997년 외환위기급)
 *  - rateIntensity = 1.0 → 기준금리 +5%p (매우 이례적인 긴축 속도)
 */
export function buildCustomScenario({ fxShockPct, rateShockPp }: CustomShockInput): StressScenario {
  const fxIntensity = Math.abs(fxShockPct) / 100;
  const rateIntensity = Math.abs(rateShockPp) / 5;

  const volMultiplier = 1 + Math.min(1.5, fxIntensity * 1.2 + rateIntensity * 0.8);
  const correlationBump = Math.min(0.45, fxIntensity * 0.5 + rateIntensity * 0.35);

  return {
    id: "custom",
    label: buildScenarioLabel(fxShockPct, rateShockPp),
    description: "직접 설정한 환율·금리 충격 강도를 반영한 커스텀 스트레스 시나리오예요.",
    fxShockPct,
    rateShockPp,
    volMultiplier,
    correlationBump,
  };
}

function buildScenarioLabel(fxShockPct: number, rateShockPp: number): string {
  const parts: string[] = [];
  if (fxShockPct !== 0) {
    parts.push(`환율 ${fxShockPct >= 0 ? "+" : ""}${fxShockPct}%`);
  }
  if (rateShockPp !== 0) {
    parts.push(`금리 ${rateShockPp >= 0 ? "+" : ""}${rateShockPp.toFixed(2)}%p`);
  }
  if (parts.length === 0) return "평시 (충격 없음)";
  return parts.join(" · ");
}
