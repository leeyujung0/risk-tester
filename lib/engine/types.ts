// 포트폴리오를 구성하는 개별 종목
export interface Asset {
  ticker: string;
  name: string;
  sector: string;
  weight: number; // 포트폴리오 내 비중 (0~1), 합계 1이 되도록 정규화됨
  expectedAnnualReturn: number; // 연환산 기대수익률 (예: 0.08 = 8%)
  annualVolatility: number; // 연환산 변동성(표준편차)
  fxSensitivity: number; // 원달러 환율 1% 변동 시 이 종목의 민감도(베타). 수출주는 +, 수입 의존/내수는 -에 가까움
  rateSensitivity: number; // 기준금리 1%p 변동 시 민감도(베타). 성장주는 -, 금융/가치주는 상대적으로 덜 민감
  /**
   * Day 4: 이 종목의 통계치(expectedAnnualReturn/annualVolatility)가 어디서 왔는지.
   * - "historical": 실제 과거 가격 시계열로 계산한 값
   * - "estimated": 실제 데이터가 없거나 부족해서 업종 평균/목업 값으로 대체(폴백)한 값
   * UI에서 "추정치 사용 중" 안내를 띄우는 데 사용한다.
   */
  dataSource?: "historical" | "estimated";
  /** 과거 수익률 시계열 (실제 상관계수 계산용). 없으면 섹터 기반 상관계수로 폴백. */
  historicalReturns?: number[];
}

export interface Portfolio {
  assets: Asset[];
}

export interface RiskProfile {
  riskTolerancePct: number | null;
}

// 조건부 거시 스트레스 시나리오
export interface StressScenario {
  id: string;
  label: string;
  description: string;
  fxShockPct: number; // 원달러 환율 충격 (%), 예: +10 = 환율 10% 상승(원화 약세)
  rateShockPp: number; // 기준금리 충격 (%p), 예: +1.0 = 1%p 인상
  volMultiplier: number; // 변동성 배수. 위기 시 변동성이 커지는 걸 반영 (1.0 = 평시)
  correlationBump: number; // 위기 시 자산 간 상관관계가 높아지는 정도 (0~1, 기존 상관계수에 더해짐, 1을 넘지 않게 클램프)
}

export interface SimulationParams {
  numSimulations: number;
  horizonDays: number; // 시뮬레이션 기간 (거래일 기준)
  confidenceLevel: number; // VaR 신뢰수준, 예: 0.95
}

export interface SimulationResult {
  finalReturns: number[]; // 각 시뮬레이션 경로의 최종 누적수익률
  maxDrawdowns: number[]; // 각 경로의 최대낙폭(MDD, 음수)
  var: number; // Value at Risk (음수, 손실률)
  cvar: number; // Conditional VaR (Expected Shortfall)
  expectedMDD: number; // 평균 MDD
  worstMDD: number; // 최악의 MDD (분포의 tail)
  medianReturn: number;
  assetContribution: AssetContribution[];
}

export interface AssetContribution {
  ticker: string;
  name: string;
  weight: number;
  contributionPp: number; // 이 종목이 시나리오 충격으로 포트폴리오 전체 수익률에 미친 영향 (%p, weight * standaloneShockReturn * 100)
  standaloneShockReturn: number; // 이 종목 단독으로 시나리오 충격을 받았을 때의 예상 수익률
}
