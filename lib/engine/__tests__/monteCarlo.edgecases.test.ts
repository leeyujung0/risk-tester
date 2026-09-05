import { test } from "node:test";
import assert from "node:assert/strict";
import { runStressSimulation } from "../monteCarlo";
import { buildCustomScenario } from "../scenarioBuilder";
import { Asset, Portfolio } from "../types";

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    ticker: "TEST",
    name: "테스트 종목",
    sector: "반도체/IT",
    weight: 1,
    expectedAnnualReturn: 0.08,
    annualVolatility: 0.3,
    fxSensitivity: 0.2,
    rateSensitivity: -0.1,
    ...overrides,
  };
}

const crisisScenario = buildCustomScenario({ fxShockPct: 10, rateShockPp: 0.75 });

function assertAllFinite(values: number[], label: string) {
  for (const v of values) {
    assert.ok(Number.isFinite(v), `${label}에 NaN/Infinity가 섞여 있습니다: ${v}`);
  }
}

function assertResultIsSane(result: ReturnType<typeof runStressSimulation>) {
  assertAllFinite(result.finalReturns, "finalReturns");
  assertAllFinite(result.maxDrawdowns, "maxDrawdowns");
  assertAllFinite(
    [result.var, result.cvar, result.expectedMDD, result.worstMDD, result.medianReturn],
    "요약 지표",
  );
  for (const c of result.assetContribution) {
    assert.ok(Number.isFinite(c.contributionPp), "assetContribution.contributionPp가 유한해야 함");
  }
}

test("종목이 1개만 있을 때(1x1 상관행렬)에도 죽지 않는다", () => {
  const portfolio: Portfolio = { assets: [makeAsset({ ticker: "A", weight: 1 })] };
  const result = runStressSimulation(portfolio, crisisScenario, {
    numSimulations: 500,
    horizonDays: 20,
    confidenceLevel: 0.95,
  });
  assert.equal(result.finalReturns.length, 500);
  assertResultIsSane(result);
});

test("특정 종목 비중이 0이어도 죽지 않고, 그 종목의 기여도는 0이다", () => {
  const portfolio: Portfolio = {
    assets: [
      makeAsset({ ticker: "A", weight: 1 }),
      makeAsset({ ticker: "B", weight: 0, sector: "금융" }),
    ],
  };
  const result = runStressSimulation(portfolio, crisisScenario, {
    numSimulations: 500,
    horizonDays: 20,
    confidenceLevel: 0.95,
  });
  assertResultIsSane(result);
  const zeroWeightAsset = result.assetContribution.find((c) => c.ticker === "B");
  assert.ok(zeroWeightAsset);
  assert.equal(zeroWeightAsset!.contributionPp, 0);
});

test("같은 섹터 종목만 있어 상관관계가 극단적으로 높아도(0.75+bump) NaN이 나오지 않는다", () => {
  const portfolio: Portfolio = {
    assets: [
      makeAsset({ ticker: "A", weight: 1, sector: "반도체/IT" }),
      makeAsset({ ticker: "B", weight: 1, sector: "반도체/IT" }),
      makeAsset({ ticker: "C", weight: 1, sector: "반도체/IT" }),
      makeAsset({ ticker: "D", weight: 1, sector: "반도체/IT" }),
    ],
  };
  // correlationBump까지 최대치 근처로 줘서 상관계수가 1에 아주 가깝게 만든다.
  const extremeScenario = buildCustomScenario({ fxShockPct: 130, rateShockPp: 10 });
  const result = runStressSimulation(portfolio, extremeScenario, {
    numSimulations: 500,
    horizonDays: 20,
    confidenceLevel: 0.95,
  });
  assertResultIsSane(result);
});

test("numSimulations이 매우 작아도(10회) 죽지 않는다", () => {
  const portfolio: Portfolio = {
    assets: [makeAsset({ ticker: "A", weight: 1 }), makeAsset({ ticker: "B", weight: 1, sector: "금융" })],
  };
  const result = runStressSimulation(portfolio, crisisScenario, {
    numSimulations: 10,
    horizonDays: 20,
    confidenceLevel: 0.95,
  });
  assert.equal(result.finalReturns.length, 10);
  assertResultIsSane(result);
});

test("포트폴리오에 종목이 하나도 없으면 명확한 에러를 던진다", () => {
  const portfolio: Portfolio = { assets: [] };
  assert.throws(() =>
    runStressSimulation(portfolio, crisisScenario, {
      numSimulations: 100,
      horizonDays: 20,
      confidenceLevel: 0.95,
    }),
  );
});

test("모든 종목의 비중(투자금액)이 0이면 명확한 에러를 던진다", () => {
  const portfolio: Portfolio = {
    assets: [makeAsset({ ticker: "A", weight: 0 }), makeAsset({ ticker: "B", weight: 0 })],
  };
  assert.throws(() =>
    runStressSimulation(portfolio, crisisScenario, {
      numSimulations: 100,
      horizonDays: 20,
      confidenceLevel: 0.95,
    }),
  );
});

test("평시 시나리오(충격 없음)에서도 정상 동작한다", () => {
  const baseline = buildCustomScenario({ fxShockPct: 0, rateShockPp: 0 });
  const portfolio: Portfolio = { assets: [makeAsset({ ticker: "A", weight: 1 })] };
  const result = runStressSimulation(portfolio, baseline, {
    numSimulations: 200,
    horizonDays: 20,
    confidenceLevel: 0.95,
  });
  assertResultIsSane(result);
});
