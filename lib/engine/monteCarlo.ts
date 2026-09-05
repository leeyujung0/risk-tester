import {
  Asset,
  AssetContribution,
  Portfolio,
  SimulationParams,
  SimulationResult,
  StressScenario,
} from "./types";
import {
  bumpCorrelation,
  choleskyDecomposition,
  correlationToCovariance,
  mean,
  percentile,
  randomNormal,
  sampleCorrelation,
} from "./statistics";
import { getSectorCorrelation } from "./sectorCorrelation";
import { MIN_HISTORICAL_OBSERVATIONS } from "./csvPriceParser";

const TRADING_DAYS_PER_YEAR = 252;

/**
 * 자산 간 상관계수 행렬을 만든다.
 *
 * Day 4: 두 종목 모두 실제 과거 수익률 시계열(historicalReturns)이 충분히 있으면
 * (최소 MIN_HISTORICAL_OBSERVATIONS개) 표본 상관계수를 계산해서 사용한다.
 * 둘 중 하나라도 데이터가 없거나 부족하면(신규 종목, 데이터 공급 실패 등)
 * Day 3의 섹터 쌍별 상관계수 테이블로 폴백한다 — 종목 쌍 단위로 섞여서
 * 계산되므로, 포트폴리오 안에 실데이터 종목과 폴백 종목이 섞여 있어도 죽지 않는다.
 */
export function buildCorrelationMatrix(assets: Asset[]): number[][] {
  const n = assets.length;
  const corr: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        corr[i][j] = 1;
        continue;
      }
      const a = assets[i];
      const b = assets[j];
      const hasEmpiricalData =
        (a.historicalReturns?.length ?? 0) >= MIN_HISTORICAL_OBSERVATIONS &&
        (b.historicalReturns?.length ?? 0) >= MIN_HISTORICAL_OBSERVATIONS;

      corr[i][j] = hasEmpiricalData
        ? sampleCorrelation(a.historicalReturns!, b.historicalReturns!)
        : getSectorCorrelation(a.sector, b.sector);
    }
  }
  return corr;
}

/**
 * 시나리오 충격을 반영한 종목별 "총 예상 리프라이싱 수익률"을 계산.
 * 환율/금리 민감도(베타) * 충격 크기를 합산하는 단순 선형모델.
 */
function computeScenarioShockReturn(asset: Asset, scenario: StressScenario): number {
  const fxEffect = asset.fxSensitivity * (scenario.fxShockPct / 100);
  const rateEffect = asset.rateSensitivity * scenario.rateShockPp * 0.01; // rateSensitivity는 1%p당 영향
  return fxEffect + rateEffect;
}

export function runStressSimulation(
  portfolio: Portfolio,
  scenario: StressScenario,
  params: SimulationParams,
): SimulationResult {
  // ── Day 3 엣지케이스 방어: 입력 자체가 계산 불가능한 경우 여기서 명확한
  //    에러로 끊어낸다. 이후 로직은 "정상적인 입력"만 받는다고 가정할 수 있다.
  if (!portfolio.assets || portfolio.assets.length === 0) {
    throw new Error("포트폴리오에 종목이 최소 1개 이상 있어야 합니다.");
  }

  const assets = normalizeWeights(portfolio.assets);
  const n = assets.length;
  const numSimulations = Math.max(1, Math.floor(params.numSimulations) || 1);
  const horizonDays = Math.max(1, Math.floor(params.horizonDays) || 1);
  const confidenceLevel = Math.min(0.999, Math.max(0.5, params.confidenceLevel));

  // 1) 일별 기대수익률 및 변동성 (연 -> 일 환산), 시나리오 충격을 드리프트에 반영
  const shockReturns = assets.map((a) => computeScenarioShockReturn(a, scenario));
  const dailyMeans = assets.map((a, i) => {
    const baseDailyDrift = a.expectedAnnualReturn / TRADING_DAYS_PER_YEAR;
    const shockDailyDrift = shockReturns[i] / horizonDays; // 시나리오 충격을 기간에 걸쳐 분산
    return baseDailyDrift + shockDailyDrift;
  });
  const dailyVols = assets.map(
    (a) => (a.annualVolatility * scenario.volMultiplier) / Math.sqrt(TRADING_DAYS_PER_YEAR),
  );

  // 2) 상관관계 행렬 (위기 시나리오에서는 상관관계가 높아짐) -> 공분산 -> Cholesky
  //    같은 섹터 종목만 있으면(예: 반도체주 3개) 상관계수가 0.9~0.98까지 올라갈 수 있는데,
  //    choleskyDecomposition 쪽에 diagonal jitter + 하한 클램프를 넣어 NaN 없이
  //    처리되도록 방어했다 (statistics.ts 참고). n=1이면 상관행렬은 그냥 [[1]]이 되어
  //    별도 분기 없이도 자연스럽게 처리된다.
  const baseCorr = buildCorrelationMatrix(assets);
  const stressedCorr = bumpCorrelation(baseCorr, scenario.correlationBump);
  const covMatrix = correlationToCovariance(stressedCorr, dailyVols);
  const L = choleskyDecomposition(covMatrix);

  // 3) 몬테카를로 경로 시뮬레이션
  const finalReturns: number[] = new Array(numSimulations);
  const maxDrawdowns: number[] = new Array(numSimulations);
  const weights = assets.map((a) => a.weight);

  for (let sim = 0; sim < numSimulations; sim++) {
    let portfolioValue = 1;
    let peak = 1;
    let worstDrawdown = 0;

    for (let day = 0; day < horizonDays; day++) {
      // 독립 표준정규 난수 n개 생성 후 Cholesky로 상관관계 부여
      const z = new Array(n).fill(0).map(() => randomNormal());
      const correlatedShocks = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = 0; k <= i; k++) {
          s += L[i][k] * z[k];
        }
        correlatedShocks[i] = s;
      }

      let portfolioDailyReturn = 0;
      for (let i = 0; i < n; i++) {
        const assetDailyReturn = dailyMeans[i] + correlatedShocks[i];
        portfolioDailyReturn += weights[i] * assetDailyReturn;
      }

      portfolioValue *= 1 + portfolioDailyReturn;
      if (portfolioValue > peak) peak = portfolioValue;
      const drawdown = (portfolioValue - peak) / peak;
      if (drawdown < worstDrawdown) worstDrawdown = drawdown;
    }

    // 방어적 처리: 이론상 위 계산에서 NaN/Infinity가 나올 수 없지만(입력을 위에서
    // 이미 정제했으므로), 만약을 대비해 결과에 섞여 나가지 않도록 최종 방어선을 둔다.
    finalReturns[sim] = Number.isFinite(portfolioValue) ? portfolioValue - 1 : 0;
    maxDrawdowns[sim] = Number.isFinite(worstDrawdown) ? worstDrawdown : 0;
  }

  // 4) 리스크 지표 계산
  const sortedReturns = [...finalReturns].sort((a, b) => a - b);
  const sortedMDD = [...maxDrawdowns].sort((a, b) => a - b);
  const varLevel = percentile(sortedReturns, 1 - confidenceLevel); // 하위 (1-conf) 분위수
  const tailLosses = sortedReturns.filter((r) => r <= varLevel);
  const cvar = tailLosses.length > 0 ? mean(tailLosses) : varLevel;

  // 5) 종목별 기여도 (시나리오 충격만 반영한 결정론적 분해, 변동성 노이즈는 제외하고
  //    "이 시나리오가 실현되면 어떤 종목이 포트폴리오 수익률을 몇 %p 끌어내리는지" 설명용으로 사용).
  //    전체 대비 비율(%)이 아니라 포트폴리오 수익률에 대한 절대 기여분(%p)으로 표현해
  //    양/음이 섞여 합이 0에 가까울 때도 값이 왜곡되지 않도록 함.
  const assetContribution: AssetContribution[] = assets.map((a, i) => ({
    ticker: a.ticker,
    name: a.name,
    weight: a.weight,
    contributionPp: weights[i] * shockReturns[i] * 100,
    standaloneShockReturn: shockReturns[i],
  }));

  return {
    finalReturns,
    maxDrawdowns,
    var: varLevel,
    cvar,
    expectedMDD: mean(sortedMDD),
    worstMDD: percentile(sortedMDD, 0.05), // 최악 5% 구간의 평균적 위치
    medianReturn: percentile(sortedReturns, 0.5),
    assetContribution,
  };
}

/**
 * 비중 합계가 1이 되도록 정규화한다.
 * 개별 종목 비중이 0인 것은 정상 케이스(그 종목은 그냥 영향이 없음)라 별도 처리가
 * 필요 없지만, 전체 합계가 0이면("모든 종목에 0원을 입력") 정규화 자체가
 * 불가능(0/0)하므로 여기서 명확한 에러로 끊어낸다.
 */
function normalizeWeights(assets: Asset[]): Asset[] {
  const total = assets.reduce((sum, a) => sum + a.weight, 0);
  if (total <= 0) {
    throw new Error("포트폴리오 비중(투자 금액) 합계가 0입니다. 최소 한 종목 이상 금액을 입력해주세요.");
  }
  return assets.map((a) => ({ ...a, weight: a.weight / total }));
}
