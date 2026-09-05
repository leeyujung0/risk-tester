import { test } from "node:test";
import assert from "node:assert/strict";
import { AssetDataProvider, FallbackDataProvider } from "../dataProvider";
import { buildCorrelationMatrix } from "../monteCarlo";
import { Asset } from "../types";
import { MIN_HISTORICAL_OBSERVATIONS } from "../csvPriceParser";

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

// ── FallbackDataProvider ────────────────────────────────────────────────
class AlwaysSucceedsProvider implements AssetDataProvider {
  async getAsset(ticker: string): Promise<Asset> {
    return makeAsset({ ticker, dataSource: "historical" });
  }
  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((t) => this.getAsset(t)));
  }
}

class AlwaysFailsProvider implements AssetDataProvider {
  async getAsset(ticker: string): Promise<Asset> {
    throw new Error(`가짜 실패: ${ticker}`);
  }
  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((t) => this.getAsset(t)));
  }
}

class FailsForSpecificTicker implements AssetDataProvider {
  constructor(private failingTicker: string) {}
  async getAsset(ticker: string): Promise<Asset> {
    if (ticker === this.failingTicker) throw new Error(`가짜 실패: ${ticker}`);
    return makeAsset({ ticker, dataSource: "historical" });
  }
  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((t) => this.getAsset(t)));
  }
}

test("FallbackDataProvider: primary가 성공하면 그 결과를 그대로 쓴다", async () => {
  const provider = new FallbackDataProvider(new AlwaysSucceedsProvider(), new AlwaysFailsProvider());
  const asset = await provider.getAsset("005930");
  assert.equal(asset.dataSource, "historical");
});

test("FallbackDataProvider: primary가 실패하면 fallback으로 넘어가고 estimated로 표시한다", async () => {
  const provider = new FallbackDataProvider(new AlwaysFailsProvider(), new AlwaysSucceedsProvider());
  const asset = await provider.getAsset("005930");
  assert.equal(asset.dataSource, "estimated");
});

test("FallbackDataProvider: 일부 종목만 실패해도 전체 getAssets는 죽지 않는다(부분 폴백)", async () => {
  const provider = new FallbackDataProvider(
    new FailsForSpecificTicker("000660"),
    new AlwaysSucceedsProvider(),
  );
  const assets = await provider.getAssets(["005930", "000660"]);
  assert.equal(assets.length, 2);
  const samsung = assets.find((a) => a.ticker === "005930")!;
  const hynix = assets.find((a) => a.ticker === "000660")!;
  assert.equal(samsung.dataSource, "historical");
  assert.equal(hynix.dataSource, "estimated"); // 실패한 종목만 폴백됨
});

test("FallbackDataProvider: primary와 fallback 모두 실패하면 에러를 던진다(죽지 않되 명확히 실패)", async () => {
  const provider = new FallbackDataProvider(new AlwaysFailsProvider(), new AlwaysFailsProvider());
  await assert.rejects(() => provider.getAsset("005930"));
});

// ── buildCorrelationMatrix: 실제 상관계수 + 섹터 폴백 혼합 ──────────────
test("buildCorrelationMatrix: 두 종목 모두 실데이터가 있으면 표본 상관계수를 그대로 쓴다", () => {
  const n = MIN_HISTORICAL_OBSERVATIONS + 5;
  const a = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));
  const b = a.map((x) => x * 3); // a와 완전히 같은 방향(상관계수 1)

  const assets: Asset[] = [
    makeAsset({ ticker: "A", historicalReturns: a, sector: "반도체/IT" }),
    makeAsset({ ticker: "B", historicalReturns: b, sector: "금융" }), // 섹터는 다르지만 실데이터 상관계수가 우선
  ];

  const corr = buildCorrelationMatrix(assets);
  assert.ok(corr[0][1] > 0.99, `실데이터 상관계수(거의 1)가 반영돼야 하는데 ${corr[0][1]}`);
});

test("buildCorrelationMatrix: 데이터가 부족한 종목이 하나라도 있으면 그 쌍은 섹터 기반으로 폴백한다", () => {
  const n = MIN_HISTORICAL_OBSERVATIONS + 5;
  const a = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));

  const assets: Asset[] = [
    makeAsset({ ticker: "A", historicalReturns: a, sector: "반도체/IT" }),
    makeAsset({ ticker: "B", historicalReturns: undefined, sector: "반도체/IT" }), // 데이터 없음 -> 섹터 폴백
  ];

  const corr = buildCorrelationMatrix(assets);
  // 같은 섹터(반도체/IT ↔ 반도체/IT) 섹터 상관계수(0.75)와 같아야 함
  assert.ok(Math.abs(corr[0][1] - 0.75) < 1e-9);
});
