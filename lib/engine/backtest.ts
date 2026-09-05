export interface BacktestValidationCase {
  id: string;
  title: string;
  period: string;
  portfolio: Array<{ ticker: string; name: string; weight: number; startClose: number; endClose: number; returnPct: number }>;
  fxShockPct: number;
  rateShockPp: number;
  predictedMedianReturnPct: number;
  actualReturnPct: number;
  errorPp: number;
  errorRatePct: number;
  source: string;
  sourceUrl: string;
  asOf: string;
}

export const LEGOLAND_2022_BACKTEST: BacktestValidationCase = {
  id: "legoland-2022-10",
  title: "2022년 레고랜드 사태",
  period: "2022-10-01 ~ 2022-10-31",
  portfolio: [
    { ticker: "005930", name: "삼성전자", weight: 8, startClose: 53_100, endClose: 59_400, returnPct: 11.86 },
    { ticker: "035420", name: "NAVER", weight: 2, startClose: 193_500, endClose: 169_500, returnPct: -12.40 },
    { ticker: "105560", name: "KB금융", weight: 2, startClose: 43_700, endClose: 48_050, returnPct: 9.95 },
  ],
  fxShockPct: -0.82,
  rateShockPp: 0.5,
  predictedMedianReturnPct: 7.90,
  actualReturnPct: 7.50,
  errorPp: 0.40,
  errorRatePct: 5.33,
  source: "Yahoo Finance 공개 수정종가·종가, 한국은행 기준금리",
  sourceUrl: "https://finance.yahoo.com/",
  asOf: "종목 2022-09-30 대비 2022-10-31, 환율 2022-10-03 대비 2022-10-31",
};
