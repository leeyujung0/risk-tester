// ─────────────────────────────────────────────────────────────────────────
// Day 2: 환율/금리 충격 강도에 대한 "역사적 근거" 프리셋.
//
// 설계 의도: 사용자가 슬라이더로 충격 강도를 자유롭게 조절하되, 그 값이 과거
// 실제 위기 국면과 비교했을 때 어느 정도 수준인지를 항상 함께 보여줘서
// "판단의 재료(역사적 맥락)는 서비스가 제공하고, 최종 조정 폭만 사용자가
// 선택하는" 구조를 만든다. 즉 사용자가 맨땅에서 %를 추측하게 두지 않는다.
//
// 아래 수치는 공개적으로 알려진 원/달러 환율·한국은행 기준금리(콜금리)
// 추이에 대한 근사치이며, 정확한 일별 수치가 아니라 "그 정도 폭으로
// 움직였다"는 대략적인 크기감을 전달하기 위한 참고용 값이다.
// (Day 4에서 실제 과거 시계열 데이터를 확보하면 더 정교한 값으로 교체 예정)
// ─────────────────────────────────────────────────────────────────────────

/**
 * MVP 단계의 "현재 환율" 기준값. 실시간 환율 API가 붙기 전까지 사용하는
 * 고정값이며, "환율이 얼마가 되면?" 입력을 %충격으로 환산하는 기준점으로 쓰인다.
 * (Day 4에서 실시간 시세 연동 시 이 상수는 제거되고 API 값으로 대체될 예정)
 */
export const CURRENT_USDKRW = 1380;

export interface FxPreset {
  id: string;
  label: string; // UI에 표시될 짧은 라벨
  fxShockPct: number; // 원/달러 환율 충격 (%, + = 원화 약세)
  note: string; // 이 수치의 역사적 근거
}

export interface RatePreset {
  id: string;
  label: string;
  rateShockPp: number; // 기준금리 충격 (%p)
  note: string;
}

export const FX_PRESETS: FxPreset[] = [
  {
    id: "calm",
    label: "평시",
    fxShockPct: 0,
    note: "특별한 충격이 없는 평상시 수준이에요.",
  },
  {
    id: "legoland-2022",
    label: "2022년 레고랜드 사태 수준",
    fxShockPct: 8,
    note:
      "2022년 9월 말~10월, 레고랜드發 자금경색 우려로 원/달러 환율이 약 1,350원에서 " +
      "1,440원대까지 3주 만에 급등했던 폭(약 +7~8%)이에요.",
  },
  {
    id: "gfc-2008",
    label: "2008년 글로벌 금융위기 수준",
    fxShockPct: 60,
    note:
      "리먼브라더스 사태 여파로 2008년 원/달러 환율이 900원대에서 1,500원대까지 " +
      "치솟았던 폭(약 +60~70%)이에요.",
  },
  {
    id: "asia-crisis-1997",
    label: "1997년 외환위기 수준",
    fxShockPct: 120,
    note:
      "IMF 구제금융 직전인 1997년, 원/달러 환율이 900원대에서 2,000원 턱밑까지 " +
      "두 배 넘게 폭등했던 폭(약 +120%)이에요. 참고로 흔히 알려진 '환율 2배' 수준은 " +
      "체감상 +40%보다 훨씬 큰 충격이었어요.",
  },
];

export const RATE_PRESETS: RatePreset[] = [
  {
    id: "calm",
    label: "평시",
    rateShockPp: 0,
    note: "특별한 충격이 없는 평상시 수준이에요.",
  },
  {
    id: "bigstep-2022",
    label: "2022년 빅스텝 1회 수준",
    rateShockPp: 0.5,
    note: "2022년 7월, 한국은행이 사상 처음으로 기준금리를 한 번에 0.50%p 올렸던 폭이에요.",
  },
  {
    id: "tightening-2022",
    label: "2022년 한 해 누적 긴축 수준",
    rateShockPp: 2.0,
    note:
      "2022년 초 1.25%였던 기준금리가 그해 말 3.25%까지, 1년 동안 여러 차례에 걸쳐 " +
      "누적으로 2.00%p 올랐던 폭이에요.",
  },
  {
    id: "asia-crisis-1997",
    label: "1997년 외환위기 수준",
    rateShockPp: 15,
    note:
      "IMF 구제금융 조건으로 콜금리가 1997년 말~1998년 초 연 12%대에서 25~30%대까지 " +
      "급등했던 극단적인 폭(약 +15%p)이에요.",
  },
];

/** 슬라이더 값과 가장 가까운 프리셋, 그리고 그 프리셋 대비 비율(근접도)을 찾는다. */
function findNearest<T>(
  presets: T[],
  value: number,
  getShock: (p: T) => number,
): { preset: T; ratio: number } {
  let nearest = presets[0];
  let minDiff = Infinity;
  for (const p of presets) {
    const diff = Math.abs(getShock(p) - value);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = p;
    }
  }
  const nearestShock = getShock(nearest);
  const ratio = nearestShock === 0 ? (value === 0 ? 1 : Infinity) : value / nearestShock;
  return { preset: nearest, ratio };
}

/** 지금 슬라이더 값이 과거 어떤 사례와 비슷한 수준인지 실시간 설명 문구를 만든다. */
export function describeFxIntensity(fxShockPct: number): string {
  if (fxShockPct === 0) return "충격이 없는 평시 수준이에요.";
  const nonZeroPresets = FX_PRESETS.filter((p) => p.fxShockPct > 0);
  const { preset, ratio } = findNearest(nonZeroPresets, fxShockPct, (p) => p.fxShockPct);

  if (Math.abs(ratio - 1) < 0.12) {
    return `${preset.label}(환율 +${preset.fxShockPct}%)과 비슷한 수준이에요.`;
  }
  if (ratio < 1) {
    return `${preset.label}의 약 ${Math.round(ratio * 100)}% 정도 되는 강도예요.`;
  }
  return `${preset.label}보다 약 ${(ratio).toFixed(1)}배 더 큰 충격이에요.`;
}

export function describeRateIntensity(rateShockPp: number): string {
  if (rateShockPp === 0) return "충격이 없는 평시 수준이에요.";
  const nonZeroPresets = RATE_PRESETS.filter((p) => p.rateShockPp > 0);
  const { preset, ratio } = findNearest(nonZeroPresets, rateShockPp, (p) => p.rateShockPp);

  if (Math.abs(ratio - 1) < 0.12) {
    return `${preset.label}(+${preset.rateShockPp.toFixed(2)}%p)과 비슷한 수준이에요.`;
  }
  if (ratio < 1) {
    return `${preset.label}의 약 ${Math.round(ratio * 100)}% 정도 되는 강도예요.`;
  }
  return `${preset.label}보다 약 ${ratio.toFixed(1)}배 더 큰 충격이에요.`;
}

/** "환율이 얼마가 되면?" 절대값 입력 ↔ %충격 상호 변환 */
export function targetFxToShockPct(targetFx: number): number {
  return ((targetFx - CURRENT_USDKRW) / CURRENT_USDKRW) * 100;
}

export function shockPctToTargetFx(fxShockPct: number): number {
  return Math.round(CURRENT_USDKRW * (1 + fxShockPct / 100));
}
