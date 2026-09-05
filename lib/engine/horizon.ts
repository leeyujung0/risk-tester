export interface HorizonOption {
  id: string;
  label: string;
  horizonDays: number;
}

// 1개월 ≈ 21거래일, 3개월 ≈ 63거래일, 6개월 ≈ 126거래일 (연 252거래일 기준 근사치)
export const HORIZON_OPTIONS: HorizonOption[] = [
  { id: "1m", label: "1개월", horizonDays: 21 },
  { id: "3m", label: "3개월", horizonDays: 63 },
  { id: "6m", label: "6개월", horizonDays: 126 },
];

export const DEFAULT_HORIZON_ID = "1m";

export function isValidHorizonDays(horizonDays: number): boolean {
  return HORIZON_OPTIONS.some((h) => h.horizonDays === horizonDays);
}
