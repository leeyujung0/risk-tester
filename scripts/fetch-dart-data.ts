import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STOCKS = [
  ["005930", "삼성전자"], ["000660", "SK하이닉스"], ["035420", "NAVER"],
  ["035720", "카카오"], ["005380", "현대차"], ["051910", "LG화학"],
  ["105560", "KB금융"], ["055550", "신한지주"], ["035900", "JYP Ent."],
  ["017670", "SK텔레콤"],
] as const;

const STOCK_TAGS = [
  ["035720", "카카오"], ["005490", "포스코"], ["055550", "신한지주"],
  ["005380", "현대차"], ["017670", "SK텔레콤"], ["012450", "한화에어로"],
  ["105560", "KB금융"], ["000660", "SK하이닉스"], ["035420", "NAVER"],
  ["035900", "JYP Ent."], ["051910", "LG화학"], ["000270", "기아"],
  ["006400", "삼성SDI"], ["352820", "하이브"], ["009150", "삼성전기"],
  ["068270", "셀트리온"], ["207940", "삼성바이오로직스"],
  ["034020", "두산에너빌리티"], ["012330", "현대모비스"],
  ["096770", "SK이노베이션"], ["030200", "KT"], ["010130", "고려아연"],
] as const;

const DISCLOSURE_KEYWORDS = {
  지배구조: ["최대주주변경", "경영권분쟁", "특수관계인거래"],
  자금조달: ["유상증자", "전환사채", "신주인수권부사채", "리픽싱"],
  재무건전성: ["관리종목", "감사의견", "자본잠식", "영업정지"],
  소송제재: ["소송", "제재", "과징금", "검찰", "조사"],
} as const;

type DartListItem = { report_nm: string; rcept_dt: string };
type DartListResponse = { status: string; message: string; list?: DartListItem[] };

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  let contents = "";
  try { contents = readFileSync(path, "utf8"); } catch { return; }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function unzipFirstFile(zip: Buffer): string {
  // DART ZIP은 data descriptor를 사용해 local header의 크기가 0일 수 있으므로
  // central directory에 기록된 실제 압축 크기와 local header 위치를 사용한다.
  let central = -1;
  for (let offset = zip.length - 22; offset >= 0; offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      central = zip.readUInt32LE(offset + 16);
      break;
    }
  }
  if (central < 0 || zip.readUInt32LE(central) !== 0x02014b50) {
    throw new Error("corpCode 응답이 올바른 ZIP 형식이 아닙니다.");
  }
  const method = zip.readUInt16LE(central + 10);
  const compressedSize = zip.readUInt32LE(central + 20);
  const local = zip.readUInt32LE(central + 42);
  const nameLength = zip.readUInt16LE(local + 26);
  const extraLength = zip.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const compressed = zip.subarray(start, start + compressedSize);
  if (method === 0) return compressed.toString("utf8");
  if (method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${method}`);
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY가 필요합니다 (.env.local 또는 환경 변수).");

  const holdings = [...new Map([...STOCKS, ...STOCK_TAGS].map(([ticker, name]) => [ticker, name])).entries()];
  const corpResponse = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`);
  if (!corpResponse.ok) throw new Error(`corp_code 조회 실패: HTTP ${corpResponse.status}`);
  const xml = unzipFirstFile(Buffer.from(await corpResponse.arrayBuffer()));
  const corpByTicker = new Map<string, string>();
  for (const blockMatch of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const block = blockMatch[1];
    const corpCode = block.match(/<corp_code>(\d+)<\/corp_code>/)?.[1];
    const ticker = block.match(/<stock_code>\s*(\d{6})\s*<\/stock_code>/)?.[1];
    if (corpCode && ticker) corpByTicker.set(ticker, corpCode);
  }

  const end = new Date();
  const begin = new Date(end);
  begin.setFullYear(begin.getFullYear() - 1);
  const summaries: string[] = [];
  console.log(`OpenDART 최근 공시 후보 (${yyyymmdd(begin)}~${yyyymmdd(end)}, ${holdings.length}종목)`);

  for (const [ticker, name] of holdings) {
    const corpCode = corpByTicker.get(ticker);
    if (!corpCode) {
      console.log(`\n${ticker} ${name} | corp_code 조회 실패`);
      summaries.push(`${ticker} ${name} | corp_code 조회 실패`);
      continue;
    }
    const params = new URLSearchParams({
      crtfc_key: apiKey, corp_code: corpCode, bgn_de: yyyymmdd(begin), end_de: yyyymmdd(end),
      page_count: "100", sort: "date", sort_mth: "desc",
    });
    const response = await fetch(`https://opendart.fss.or.kr/api/list.json?${params}`);
    if (!response.ok) throw new Error(`${ticker} 공시 조회 실패: HTTP ${response.status}`);
    const data = await response.json() as DartListResponse;
    if (data.status !== "000" && data.status !== "013") {
      throw new Error(`${ticker} 공시 조회 실패: ${data.status} ${data.message}`);
    }
    const candidates = (data.list ?? [])
      .map((item) => ({
        ...item,
        categories: Object.entries(DISCLOSURE_KEYWORDS)
          .filter(([, keywords]) => keywords.some((keyword) => item.report_nm.replaceAll(" ", "").includes(keyword)))
          .map(([category]) => category),
      }))
      .filter(({ categories }) => categories.length > 0)
      .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))
      .slice(0, 2);
    console.log(`\n${ticker} ${name} (corp_code: ${corpCode})`);
    if (candidates.length === 0) console.log("  특이사항 없음");
    else for (const item of candidates) {
      console.log(`  ${ticker} | ${item.report_nm} | ${item.rcept_dt} | ${item.categories.join(", ")}`);
    }
    summaries.push(`${ticker} ${name} | ${candidates.length ? `후보 ${candidates.length}건` : "특이사항 없음"}`);
  }
  console.log("\n=== 종목별 요약 ===");
  for (const summary of summaries) console.log(summary);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
