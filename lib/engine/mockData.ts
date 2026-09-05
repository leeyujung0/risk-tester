import { Asset } from "./types";

const estimatedAsset = (
  ticker: string, name: string, sector: string,
  expectedAnnualReturn: number, annualVolatility: number,
  fxSensitivity: number, rateSensitivity: number,
): Asset => ({ ticker, name, sector, weight: 0, expectedAnnualReturn, annualVolatility, fxSensitivity, rateSensitivity });

// ─────────────────────────────────────────────────────────────────────────
// MVP 프로토타입용 샘플 종목 풀.
//
// expectedAnnualReturn / annualVolatility는 업종 평균에 대한 정성적 근사치다.
// Day 4에서 이 값들을 실제 시세로 교체하는 파이프라인(KIS API 또는 CSV)까지는
// 구현했지만, 실제 시세 데이터 자체는 아직 이 저장소에 없어서 지금은 여전히
// 이 목업 값이 쓰이는 상태다. defaultDataProvider(dataProvider.ts)가
// KIS_APP_KEY/KIS_APP_SECRET 환경변수나 data/prices.csv 파일을 찾으면 자동으로
// 그쪽 실데이터를 우선 사용하고, 없거나 실패하면 이 목업 값으로 폴백한다.
//
// fxSensitivity / rateSensitivity 근거 (Day 2 재검토):
// - fxSensitivity: 환율이 1% 오를 때(원화 약세) 이 종목의 기대수익률이 몇 %p
//   움직이는지에 대한 근사 베타. 해외 매출 비중, 원자재/부품 수입 의존도,
//   외화 부채 규모를 정성적으로 반영한 값이며 실제 헤지 비율은 고려하지 않은
//   단순화된 선형 근사치다.
// - rateSensitivity: 기준금리가 1%p 오를 때의 근사 베타. 성장주는 미래 이익
//   할인 부담이 커져 음(-)의 값이 크고, 은행/금융주는 예대마진 확대로 양(+)의
//   값을 가진다.
// - 절대적인 정밀도보다 "부호(방향)"와 "상대적 크기"가 맞는지를 우선 검증했다.
// - Day 4: 실제 과거 수익률과 환율 변화를 회귀분석해서 이 값을 검증/교체하는
//   도구(scripts/estimateSensitivities.ts)까지 만들어뒀다. 실제 시세 CSV가
//   생기면 그 스크립트로 나온 베타를 참고해 아래 값을 갱신할 것.
// ─────────────────────────────────────────────────────────────────────────
export const SAMPLE_UNIVERSE: Asset[] = [
  {
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체/IT",
    weight: 0,
    expectedAnnualReturn: 0.09,
    annualVolatility: 0.28,
    // 매출의 대부분이 해외(반도체·스마트폰)에서 발생해 원화 약세 시 환산 이익이 늘어남.
    // 다만 대규모 자체 헤지와 해외 생산기지 비중을 감안해 1:1보다는 낮은 베타로 가정.
    fxSensitivity: 0.35,
    // 이익 기반 밸류에이션(저PER)이라 순수 성장주보다 금리 민감도는 상대적으로 낮음.
    rateSensitivity: -0.15,
  },
  {
    ticker: "000660",
    name: "SK하이닉스",
    sector: "반도체/IT",
    weight: 0,
    expectedAnnualReturn: 0.12,
    annualVolatility: 0.38,
    // 삼성전자보다 해외 매출 비중이 더 높고 자체 헤지 여력은 상대적으로 작아 fx 베타를 더 높게 설정.
    fxSensitivity: 0.4,
    // 메모리 업황 특성상 이익 변동성이 커서 밸류에이션의 금리 민감도도 더 크게 반영.
    rateSensitivity: -0.25,
  },
  {
    ticker: "035420",
    name: "NAVER",
    sector: "플랫폼/성장주",
    weight: 0,
    expectedAnnualReturn: 0.07,
    annualVolatility: 0.33,
    // 매출은 대부분 내수 광고/커머스이나, 해외 서버·라이선스 비용 지출이 있어 약한 음(-)의 노출로 가정.
    fxSensitivity: -0.05,
    // 아직 실현이익 대비 고평가된 성장주 특성상 금리 인상에 밸류에이션이 크게 흔들림.
    rateSensitivity: -0.4,
  },
  {
    ticker: "035720",
    name: "카카오",
    sector: "플랫폼/성장주",
    weight: 0,
    expectedAnnualReturn: 0.05,
    annualVolatility: 0.4,
    // NAVER와 마찬가지로 내수 중심이라 fx 노출은 미미한 수준으로 가정.
    fxSensitivity: -0.03,
    // NAVER보다도 이익 대비 밸류에이션 부담이 커 금리 민감도를 더 크게 반영.
    rateSensitivity: -0.45,
  },
  {
    ticker: "005380",
    name: "현대차",
    sector: "수출제조업",
    weight: 0,
    expectedAnnualReturn: 0.08,
    annualVolatility: 0.3,
    // 해외 판매 비중이 높지만 해외 현지생산 비중도 커서(자연 헤지) 순수 수출주보다는 베타를 낮게 설정.
    fxSensitivity: 0.3,
    // 완성차는 경기민감 가치주 성격이 강해 성장주 대비 금리 민감도는 낮은 편.
    rateSensitivity: -0.1,
  },
  {
    ticker: "051910",
    name: "LG화학",
    sector: "수출제조업",
    weight: 0,
    expectedAnnualReturn: 0.06,
    annualVolatility: 0.34,
    // 배터리/석유화학 모두 해외 매출 비중이 크고 원재료도 달러 표시 결제가 많아 상쇄 효과 일부 반영.
    fxSensitivity: 0.25,
    rateSensitivity: -0.15,
  },
  {
    ticker: "105560",
    name: "KB금융",
    sector: "금융",
    weight: 0,
    expectedAnnualReturn: 0.06,
    annualVolatility: 0.24,
    // 외화 자산/부채가 있으나 국내 은행업 특성상 환율 노출은 크지 않아 약한 음(-)으로 가정.
    fxSensitivity: -0.1,
    // 금리 상승 시 예대마진 확대로 상대적 수혜. 단, 과도한 급격한 인상은 부실채권 우려로
    // 실제로는 비선형적일 수 있으나 MVP 단계에서는 단순 선형 양(+) 베타로 근사.
    rateSensitivity: 0.3,
  },
  {
    ticker: "055550",
    name: "신한지주",
    sector: "금융",
    weight: 0,
    expectedAnnualReturn: 0.06,
    annualVolatility: 0.24,
    fxSensitivity: -0.1,
    rateSensitivity: 0.28,
  },
  {
    ticker: "035900",
    name: "JYP Ent.",
    sector: "내수/소비재",
    weight: 0,
    expectedAnnualReturn: 0.1,
    annualVolatility: 0.42,
    // 음반·굿즈 수출 및 아티스트 해외 활동 매출 비중이 최근 크게 늘어 수출주에 가까운 양(+) 노출로 재조정.
    fxSensitivity: 0.15,
    // 이익 변동성이 큰 성장형 소비재 특성상 금리 민감도도 상대적으로 큰 편.
    rateSensitivity: -0.2,
  },
  {
    ticker: "017670",
    name: "SK텔레콤",
    sector: "내수/소비재",
    weight: 0,
    expectedAnnualReturn: 0.04,
    annualVolatility: 0.18,
    // 순수 내수 통신 서비스업이라 fx 노출은 통신장비 수입분 정도로 거의 없음.
    fxSensitivity: -0.02,
    // 배당주 성격이 강해 금리에 약하게 음(-)으로 반응(대체 투자 매력 감소 정도로 근사).
    rateSensitivity: 0.05,
  },
  estimatedAsset("005490", "포스코", "철강", 0.06, 0.3, 0.2, -0.1),
  estimatedAsset("012450", "한화에어로", "방산/항공", 0.1, 0.38, 0.3, -0.15),
  estimatedAsset("068270", "셀트리온", "바이오", 0.08, 0.36, 0.15, -0.3),
  estimatedAsset("373220", "LG에너지", "배터리", 0.08, 0.37, 0.25, -0.25),
  estimatedAsset("000270", "기아", "자동차", 0.08, 0.3, 0.3, -0.1),
  estimatedAsset("006400", "삼성SDI", "배터리", 0.07, 0.36, 0.22, -0.25),
  estimatedAsset("352820", "하이브", "엔터", 0.09, 0.4, 0.15, -0.25),
  estimatedAsset("009150", "삼성전기", "전자부품", 0.07, 0.32, 0.28, -0.18),
  estimatedAsset("207940", "삼성바이오로직스", "바이오", 0.09, 0.3, 0.12, -0.25),
  estimatedAsset("034020", "두산에너빌리티", "에너지", 0.08, 0.4, 0.1, -0.15),
  estimatedAsset("012330", "현대모비스", "자동차부품", 0.06, 0.25, 0.25, -0.08),
  estimatedAsset("096770", "SK이노베이션", "에너지", 0.06, 0.38, 0.18, -0.18),
  estimatedAsset("030200", "KT", "통신", 0.04, 0.17, -0.02, 0.05),
  estimatedAsset("010130", "고려아연", "비철금속", 0.06, 0.3, 0.2, -0.1),
];
