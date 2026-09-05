import { mean, stdDev } from "./statistics";

const TRADING_DAYS_PER_YEAR = 252;

/** 종목 하나의 실제 데이터 기반 통계치 */
export interface HistoricalAssetStats {
  ticker: string;
  expectedAnnualReturn: number;
  annualVolatility: number;
  dailyReturns: number[]; // 상관계수 계산에 재사용
  numObservations: number;
}

/**
 * CSV 한 줄 형식: date,ticker,close  (예: 2024-01-02,005930,78500)
 * - 헤더 줄(date,ticker,close)이 있어도 없어도 동작하도록 숫자로 파싱 안 되는 줄은 건너뛴다.
 * - 종목별로 날짜 오름차순 정렬 후 일별 단순수익률을 계산한다.
 */
export function parsePriceCsv(csvText: string): Map<string, { date: string; close: number }[]> {
  const byTicker = new Map<string, { date: string; close: number }[]>();

  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [date, ticker, closeRaw] = trimmed.split(",").map((s) => s.trim());
    const close = Number(closeRaw);
    if (!date || !ticker || !Number.isFinite(close) || close <= 0) {
      continue; // 헤더 줄이거나 손상된 줄은 조용히 스킵 (Day4-4: 데이터 오류에도 죽지 않기)
    }
    const arr = byTicker.get(ticker) ?? [];
    arr.push({ date, close });
    byTicker.set(ticker, arr);
  }

  for (const arr of byTicker.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  return byTicker;
}

/**
 * 최소 이 정도 관측치는 있어야 "실제 데이터 기반" 통계치로 신뢰하고 쓴다.
 * 이보다 적으면(예: 상장한 지 얼마 안 됐거나 데이터가 일부 누락) 폴백을 쓰는 게 낫다.
 */
export const MIN_HISTORICAL_OBSERVATIONS = 60;

/** 정렬된 종가 시계열 -> 일별 단순수익률 배열 (길이는 종가 개수 - 1) */
export function computeDailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      returns.push(curr / prev - 1);
    }
  }
  return returns;
}

/**
 * 종목별 종가 시계열로부터 연환산 기대수익률/변동성을 계산한다.
 * 데이터가 MIN_HISTORICAL_OBSERVATIONS보다 적으면 null을 반환해서
 * 호출부(dataProvider)가 폴백(mock/섹터 평균)으로 넘어가도록 한다.
 */
export function computeHistoricalStats(
  ticker: string,
  priceSeries: { date: string; close: number }[],
): HistoricalAssetStats | null {
  const closes = priceSeries.map((p) => p.close);
  const dailyReturns = computeDailyReturns(closes);

  if (dailyReturns.length < MIN_HISTORICAL_OBSERVATIONS) {
    return null;
  }

  const dailyMean = mean(dailyReturns);
  const dailyStd = stdDev(dailyReturns);

  const expectedAnnualReturn = dailyMean * TRADING_DAYS_PER_YEAR;
  const annualVolatility = dailyStd * Math.sqrt(TRADING_DAYS_PER_YEAR);

  return {
    ticker,
    expectedAnnualReturn,
    annualVolatility,
    dailyReturns,
    numObservations: dailyReturns.length,
  };
}
