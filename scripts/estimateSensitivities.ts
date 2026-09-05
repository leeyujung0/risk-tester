/**
 * 실제 데이터 기반 fxSensitivity(환율 베타) 추정 스크립트.
 *
 * mockData.ts의 fxSensitivity/rateSensitivity 값은 현재 정성적 근거(Day 2 코드
 * 주석 참고)로만 채워져 있다. 실제 시세 CSV가 준비되면(KIS API로 받았든, 다른
 * 경로로 받았든) 이 스크립트로 특정 위기 구간 동안의 실제 회귀 베타를 뽑아서
 * mockData.ts 값을 검증/교체하는 데 참고할 수 있다.
 *
 * ⚠️ 아직 이 저장소에는 실제 시세 CSV가 없어서 이 스크립트를 실행해본 적은 없다.
 * 로직(파싱, 일별수익률 계산, OLS 회귀)은 lib/engine의 기존 유닛 테스트를 통과한
 * 함수들을 그대로 재사용하므로 계산 자체는 신뢰할 수 있지만, 실제 CSV 포맷이
 * 조금 다르면(구분자, 헤더 유무, 날짜 형식) parsePriceCsv 쪽을 함께 확인해야 한다.
 *
 * 사용법:
 *   npx tsx scripts/estimateSensitivities.ts <prices.csv> <usdkrw.csv> <시작일> <종료일>
 *
 * 예시 (2022년 레고랜드 사태 구간):
 *   npx tsx scripts/estimateSensitivities.ts data/prices.csv data/usdkrw.csv 2022-09-01 2022-11-15
 *
 * 입력 파일 형식:
 *   prices.csv  : date,ticker,close   (여러 종목이 섞여 있어도 됨)
 *   usdkrw.csv  : date,close          (원/달러 환율, 종목 컬럼 없이 2컬럼)
 *
 * 출력: 종목별 { beta(환율 1% 변동당 일별수익률 민감도의 근사), R^2, 관측치 수 }
 * beta는 "일별수익률 대 일별 환율변화율" 회귀 기울기이므로, mockData.ts의
 * fxSensitivity(연 단위 근사 베타)와 스케일이 다를 수 있다는 점을 감안해서
 * 부호와 상대적 크기 위주로 참고할 것.
 */
import fs from "fs";
import { parsePriceCsv, computeDailyReturns } from "../lib/engine/csvPriceParser";
import { linearRegression } from "../lib/engine/statistics";

function parseTwoColumnCsv(filePath: string): { date: string; close: number }[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const rows: { date: string; close: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [date, closeRaw] = trimmed.split(",").map((s) => s.trim());
    const close = Number(closeRaw);
    if (date && Number.isFinite(close) && close > 0) {
      rows.push({ date, close });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

function filterByDateRange<T extends { date: string }>(rows: T[], start: string, end: string): T[] {
  return rows.filter((r) => r.date >= start && r.date <= end);
}

function main() {
  const [pricesPath, fxPath, startDate, endDate] = process.argv.slice(2);
  if (!pricesPath || !fxPath || !startDate || !endDate) {
    console.error(
      "사용법: npx tsx scripts/estimateSensitivities.ts <prices.csv> <usdkrw.csv> <시작일 YYYY-MM-DD> <종료일 YYYY-MM-DD>",
    );
    process.exit(1);
  }

  const priceCsv = fs.readFileSync(pricesPath, "utf-8");
  const byTicker = parsePriceCsv(priceCsv);

  const fxSeries = filterByDateRange(parseTwoColumnCsv(fxPath), startDate, endDate);
  const fxReturns = computeDailyReturns(fxSeries.map((r) => r.close));

  console.log(`기간: ${startDate} ~ ${endDate}`);
  console.log(`환율 관측치 ${fxSeries.length}개 (일별수익률 ${fxReturns.length}개)\n`);
  console.log("ticker\tbeta(환율 민감도)\tR^2\tn");

  for (const [ticker, series] of byTicker.entries()) {
    const filtered = filterByDateRange(series, startDate, endDate);
    const stockReturns = computeDailyReturns(filtered.map((r) => r.close));
    const { beta, rSquared, n } = linearRegression(fxReturns, stockReturns);
    if (n < 5) {
      console.log(`${ticker}\t(관측치 부족: ${n}개, 스킵)`);
      continue;
    }
    console.log(`${ticker}\t${beta.toFixed(3)}\t${rSquared.toFixed(3)}\t${n}`);
  }
}

main();
