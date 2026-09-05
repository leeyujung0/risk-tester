export type RiskCategory =
  | "지배구조" | "자금조달" | "재무건전성" | "소송제재"
  | "지배구조, 소송제재" | "자금조달, 소송제재" | "없음";
export type RiskSeverity = "없음" | "낮음" | "중간" | "높음";

export interface CompanyRiskSource {
  ticker: string;
  name: string;
  riskCategory: RiskCategory;
  severity: RiskSeverity;
  summary: string;
  sourceDate: string | null;
  placeholder: boolean;
}

const REVIEWED_RISKS: CompanyRiskSource[] = [
  {
    ticker: "010130", name: "고려아연", riskCategory: "지배구조, 소송제재", severity: "높음",
    summary: "최대주주 영풍·MBK파트너스 연합과 현 경영진(최윤범 회장) 간 경영권 분쟁이 2년 넘게 지속 중이며, 2026년 9월 임시주주총회를 앞두고 소송·정정공시가 반복되고 있습니다. 분쟁 장기화로 이사회 의사결정과 지배구조 안정성에 대한 불확실성이 이어지고 있습니다.",
    sourceDate: "2026-09-04", placeholder: false,
  },
  {
    ticker: "000660", name: "SK하이닉스", riskCategory: "자금조달", severity: "중간",
    summary: "2026년 7월 유상증자를 결정·완료했습니다. 신주 발행에 따른 지분 희석 가능성이 있으나, 반도체 업황 개선 국면에서의 투자 재원 확보 목적으로 풀이됩니다.",
    sourceDate: "2026-07-15", placeholder: false,
  },
  {
    ticker: "035420", name: "NAVER", riskCategory: "자금조달", severity: "낮음",
    summary: "2026년 7월 유상증자 결정을 공시했습니다. 세부 목적과 규모에 따라 주주가치에 미치는 영향을 지켜볼 필요가 있습니다.",
    sourceDate: "2026-07-27", placeholder: false,
  },
  {
    ticker: "051910", name: "LG화학", riskCategory: "자금조달, 소송제재", severity: "중간",
    summary: "2026년 2월 종속회사 유상증자와 함께 소송 관련 판결·결정 공시가 있었습니다. 계열사 자금조달과 법적 분쟁이 동시에 진행 중입니다.",
    sourceDate: "2026-02-25", placeholder: false,
  },
  {
    ticker: "105560", name: "KB금융", riskCategory: "자금조달", severity: "낮음",
    summary: "2026년 6월 자회사 유상증자를 결정했습니다. 지주사 본체가 아닌 자회사 단위 조달로 영향은 제한적입니다.",
    sourceDate: "2026-06-26", placeholder: false,
  },
  {
    ticker: "012450", name: "한화에어로", riskCategory: "자금조달", severity: "낮음",
    summary: "2026년 3월 종속회사 유상증자 결정이 있었습니다.",
    sourceDate: "2026-03-04", placeholder: false,
  },
  {
    ticker: "352820", name: "하이브", riskCategory: "자금조달", severity: "낮음",
    summary: "2026년 4월 종속회사 유상증자를 결정했습니다.",
    sourceDate: "2026-04-01", placeholder: false,
  },
  {
    ticker: "207940", name: "삼성바이오로직스", riskCategory: "자금조달", severity: "중간",
    summary: "2026년 8월 유상증자 결정(본사 기준)과 3월 종속회사 유상증자가 함께 있었습니다. 반복적인 자금조달 움직임이 확인됩니다.",
    sourceDate: "2026-08-28", placeholder: false,
  },
];

const NO_MAJOR_RISK_COMPANIES = [
  ["005930", "삼성전자"], ["035720", "카카오"], ["005380", "현대차"],
  ["055550", "신한지주"], ["035900", "JYP Ent."], ["017670", "SK텔레콤"],
  ["005490", "포스코"], ["000270", "기아"], ["006400", "삼성SDI"],
  ["009150", "삼성전기"], ["068270", "셀트리온"], ["034020", "두산에너빌리티"],
  ["012330", "현대모비스"], ["096770", "SK이노베이션"], ["030200", "KT"],
] as const;

const NO_MAJOR_RISKS: CompanyRiskSource[] = NO_MAJOR_RISK_COMPANIES.map(([ticker, name]) => ({
  ticker,
  name,
  riskCategory: "없음",
  severity: "없음",
  summary: "최근 1년 내 주요 리스크성 공시가 확인되지 않았습니다.",
  sourceDate: "2026-09-05",
  placeholder: false,
}));

export const COMPANY_RISK_FALLBACK = new Map<string, CompanyRiskSource>(
  [...REVIEWED_RISKS, ...NO_MAJOR_RISKS].map((source) => [source.ticker, source]),
);

export function pendingCompanyRisk(ticker: string): CompanyRiskSource {
  return {
    ticker,
    name: ticker,
    riskCategory: "없음",
    severity: "없음",
    summary: "공시 리스크 정보 준비 중",
    sourceDate: null,
    placeholder: true,
  };
}
