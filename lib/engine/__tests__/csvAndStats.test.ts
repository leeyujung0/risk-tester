import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDailyReturns,
  computeHistoricalStats,
  parsePriceCsv,
  MIN_HISTORICAL_OBSERVATIONS,
} from "../csvPriceParser";
import { sampleCorrelation, linearRegression } from "../statistics";

test("parsePriceCsv: 정상 데이터를 종목별로 날짜순 정렬해서 파싱한다", () => {
  const csv = ["2024-01-03,005930,71000", "2024-01-02,005930,70000", "2024-01-02,000660,120000"].join(
    "\n",
  );
  const parsed = parsePriceCsv(csv);
  assert.equal(parsed.size, 2);
  const samsung = parsed.get("005930")!;
  assert.equal(samsung.length, 2);
  assert.equal(samsung[0].date, "2024-01-02"); // 날짜순 정렬됐는지
  assert.equal(samsung[1].date, "2024-01-03");
});

test("parsePriceCsv: 헤더 줄이나 손상된 줄은 조용히 무시한다(죽지 않는다)", () => {
  const csv = ["date,ticker,close", "2024-01-02,005930,70000", "이상한,줄,abc", ",,", "2024-01-03,005930,-100"].join(
    "\n",
  );
  const parsed = parsePriceCsv(csv);
  const samsung = parsed.get("005930")!;
  assert.equal(samsung.length, 1); // 헤더/손상줄/음수가격은 스킵되고 정상 줄 1개만 남음
});

test("computeDailyReturns: 단순수익률을 정확히 계산한다", () => {
  const returns = computeDailyReturns([100, 110, 99]);
  assert.equal(returns.length, 2);
  assert.ok(Math.abs(returns[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(returns[1] - (99 / 110 - 1)) < 1e-9);
});

test("computeHistoricalStats: 관측치가 부족하면 null을 반환해 폴백을 유도한다", () => {
  const shortSeries = Array.from({ length: 10 }, (_, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, "0")}`,
    close: 100 + i,
  }));
  const stats = computeHistoricalStats("TEST", shortSeries);
  assert.equal(stats, null);
});

test("computeHistoricalStats: 관측치가 충분하면 연환산 통계치를 계산한다", () => {
  // 매일 +0.1%씩 꾸준히 오르는 가상의(실제 데이터 아님) 시계열
  const n = MIN_HISTORICAL_OBSERVATIONS + 10;
  const series = Array.from({ length: n }, (_, i) => ({
    date: `day-${i}`,
    close: 100 * Math.pow(1.001, i),
  }));
  const stats = computeHistoricalStats("TEST", series);
  assert.ok(stats !== null);
  assert.equal(stats!.numObservations, n - 1);
  // 매일 +0.1%이므로 연환산 기대수익률은 대략 0.1% * 252 근방이어야 함
  assert.ok(stats!.expectedAnnualReturn > 0.2 && stats!.expectedAnnualReturn < 0.35);
  // 변동성이 거의 없는(결정론적) 시계열이므로 annualVolatility는 0에 가까워야 함
  assert.ok(stats!.annualVolatility < 0.01);
});

test("sampleCorrelation: 완전히 같은 방향으로 움직이는 두 시계열은 상관계수 1에 가깝다", () => {
  const a = [0.01, -0.02, 0.03, 0.015, -0.005];
  const b = a.map((x) => x * 2); // 완전한 선형 관계
  const r = sampleCorrelation(a, b);
  assert.ok(r > 0.999);
});

test("sampleCorrelation: 변동이 전혀 없는 시계열은 0을 반환한다(정의 불가 방어)", () => {
  const a = [0.01, 0.01, 0.01, 0.01];
  const b = [0.02, -0.01, 0.03, 0.0];
  const r = sampleCorrelation(a, b);
  assert.equal(r, 0);
  assert.ok(Number.isFinite(r));
});

test("linearRegression: y = 2x 관계에서 beta ≈ 2, R^2 ≈ 1", () => {
  const x = [0.01, -0.02, 0.03, 0.015, -0.005, 0.02];
  const y = x.map((v) => v * 2);
  const { beta, rSquared } = linearRegression(x, y);
  assert.ok(Math.abs(beta - 2) < 1e-9);
  assert.ok(rSquared > 0.999);
});
