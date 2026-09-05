import fs from "fs";
import path from "path";
import { Asset } from "./types";
import { SAMPLE_UNIVERSE } from "./mockData";
import { computeHistoricalStats, parsePriceCsv, MIN_HISTORICAL_OBSERVATIONS } from "./csvPriceParser";

/**
 * 종목 데이터 소스를 추상화하는 인터페이스.
 * API 라우트는 이 인터페이스를 통해서만 데이터를 가져오므로, 아래 구현체 중
 * 무엇을 쓰든(Mock/CSV/KIS) 나머지 코드는 손댈 필요가 없다.
 */
export interface AssetDataProvider {
  getAsset(ticker: string): Promise<Asset>;
  getAssets(tickers: string[]): Promise<Asset[]>;
}

export class UnknownTickerError extends Error {
  constructor(ticker: string) {
    super(`알 수 없는 종목 코드: ${ticker}`);
    this.name = "UnknownTickerError";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 1) MockDataProvider — Day 1~3에서 쓰던 하드코딩 SAMPLE_UNIVERSE.
//    항상 즉시 성공하므로 다른 프로바이더들의 최종 폴백(fallback of last resort)으로도 쓰인다.
// ─────────────────────────────────────────────────────────────────────────
export class MockDataProvider implements AssetDataProvider {
  async getAsset(ticker: string): Promise<Asset> {
    const found = SAMPLE_UNIVERSE.find((a) => a.ticker === ticker);
    if (!found) {
      throw new UnknownTickerError(ticker);
    }
    return { ...found, dataSource: "estimated" };
  }

  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((ticker) => this.getAsset(ticker)));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2) HistoricalCsvDataProvider — 사전에 다운로드해둔 CSV(date,ticker,close)로
//    실제 연환산 기대수익률/변동성 + 상관계수 계산용 일별수익률 시계열을 만든다.
//    이름/섹터/fxSensitivity 등 "가격 데이터에 없는" 정성적 메타데이터는
//    mockData.ts의 값을 그대로 가져다 쓴다 (가격만 실데이터로 교체하는 구조).
// ─────────────────────────────────────────────────────────────────────────
export class HistoricalCsvDataProvider implements AssetDataProvider {
  private pricesByTicker: Map<string, { date: string; close: number }[]>;

  constructor(csvText: string) {
    this.pricesByTicker = parsePriceCsv(csvText);
  }

  async getAsset(ticker: string): Promise<Asset> {
    const meta = SAMPLE_UNIVERSE.find((a) => a.ticker === ticker);
    if (!meta) {
      throw new UnknownTickerError(ticker);
    }

    const series = this.pricesByTicker.get(ticker);
    if (!series || series.length === 0) {
      throw new Error(`종목 ${ticker}의 CSV 가격 데이터가 없습니다 (상장폐지·심볼 불일치 가능).`);
    }

    const stats = computeHistoricalStats(ticker, series);
    if (!stats) {
      throw new Error(
        `종목 ${ticker}의 CSV 데이터가 부족합니다 (관측치 ${series.length}개, 최소 ${MIN_HISTORICAL_OBSERVATIONS}개 필요).`,
      );
    }

    return {
      ...meta,
      expectedAnnualReturn: stats.expectedAnnualReturn,
      annualVolatility: stats.annualVolatility,
      historicalReturns: stats.dailyReturns,
      dataSource: "historical",
    };
  }

  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((ticker) => this.getAsset(ticker)));
  }
}

/** data/prices.csv 파일이 있으면 그걸로 CSV 프로바이더를 만들고, 없으면 null. */
export function tryCreateCsvProviderFromFile(
  filePath: string = process.env.PRICE_CSV_PATH || path.join(process.cwd(), "data", "prices.csv"),
): HistoricalCsvDataProvider | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const csvText = fs.readFileSync(filePath, "utf-8");
    return new HistoricalCsvDataProvider(csvText);
  } catch (e) {
    console.warn(`[dataProvider] CSV 파일 로드 실패(${filePath}): ${(e as Error).message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3) KisDataProvider — 한국투자증권(KIS) Open API 연동.
//
//    ⚠️ 검증 상태: 이 구현은 KIS Open API의 공개된 명세(엔드포인트 경로,
//    요청/응답 필드명)를 기반으로 작성했지만, 이 환경은 외부 네트워크 접근이
//    막혀 있어 실제 키로 호출 테스트를 해보지 못했다. 필드명 등 세부사항은
//    KIS 공식 문서/포럼과 다를 수 있으니, 실제 앱키·시크릿을 발급받은 뒤
//    아래 tr_id, 요청 파라미터명, 응답 파싱(response.output2)을 먼저 콘솔
//    로그로 확인하고 필요하면 조정해서 쓰는 걸 권장한다.
//
//    필요한 환경변수:
//      KIS_APP_KEY, KIS_APP_SECRET  (KIS 개발자센터에서 앱 등록 후 발급)
//      KIS_BASE_URL (선택, 기본값은 실전 도메인. 모의투자는
//        https://openapivts.koreainvestment.com:29443 로 바꿔서 사용)
// ─────────────────────────────────────────────────────────────────────────
export interface KisConfig {
  appKey: string;
  appSecret: string;
  baseUrl?: string;
}

interface KisTokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const KIS_REQUEST_INTERVAL_MS = 100;
const KIS_ASSET_CACHE_TTL_MS = 10 * 60 * 1000;
const KIS_TARGET_TRADING_DAYS = 252;
const KIS_PRICE_POINTS_NEEDED = KIS_TARGET_TRADING_DAYS + 1;
const KIS_PAGE_INTERVAL_MS = 1000;
const KIS_PRELOAD_INTERVAL_MS = 5 * 60 * 1000;
const KIS_DEMO_TICKERS = [
  "005930", "000660", "035420", "035720", "005380",
  "051910", "105560", "055550", "035900", "017670",
] as const;
let kisRequestQueue: Promise<void> = Promise.resolve();
let kisAssetQueue: Promise<void> = Promise.resolve();
let lastKisRequestAt = 0;

function enqueueKisRequest<T>(request: () => Promise<T>): Promise<T> {
  const queued = kisRequestQueue.then(async () => {
    const waitMs = Math.max(0, KIS_REQUEST_INTERVAL_MS - (Date.now() - lastKisRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      return await request();
    } finally {
      lastKisRequestAt = Date.now();
    }
  });
  kisRequestQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function enqueueKisAsset<T>(request: () => Promise<T>): Promise<T> {
  const queued = kisAssetQueue.then(request);
  kisAssetQueue = queued.then(
    () => new Promise<void>((resolve) => setTimeout(resolve, KIS_PAGE_INTERVAL_MS)),
    () => new Promise<void>((resolve) => setTimeout(resolve, KIS_PAGE_INTERVAL_MS)),
  );
  return queued;
}

function formatKisDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export class KisDataProvider implements AssetDataProvider {
  private readonly baseUrl: string;
  private tokenCache: KisTokenCache | null = null;
  private tokenRequest: Promise<string> | null = null;
  private readonly assetCache = new Map<string, { asset: Asset; expiresAt: number }>();
  private preloadRequest: Promise<void> | null = null;

  constructor(private config: KisConfig) {
    this.baseUrl = config.baseUrl ?? "https://openapi.koreainvestment.com:9443";
  }

  private async getAccessToken(): Promise<string> {
    // 토큰은 보통 24시간 유효하고, 발급 자체에 횟수 제한이 있어 캐싱이 필수다.
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    if (this.tokenRequest) return this.tokenRequest;

    const request = enqueueKisRequest(async () => {
      const res = await fetch(`${this.baseUrl}/oauth2/tokenP`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: this.config.appKey,
          appsecret: this.config.appSecret,
        }),
      });

      if (!res.ok) throw new Error(`KIS 인증 토큰 발급 실패 (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.access_token) throw new Error("KIS 인증 응답에 access_token이 없습니다.");
      const expiresInSec = Number(data.expires_in ?? 86400);
      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + expiresInSec * 1000,
      };
      return this.tokenCache.accessToken;
    });
    this.tokenRequest = request;
    try {
      return await request;
    } finally {
      if (this.tokenRequest === request) this.tokenRequest = null;
    }
  }

  /** 최근 252거래일 수익률 계산에 필요한 253개 종가를 페이지 단위로 조회한다. */
  private async fetchDailyPrices(
    ticker: string,
    startDate: string,
    endDate: string,
  ): Promise<{ date: string; close: number }[]> {
    const token = await this.getAccessToken();
    const pricesByDate = new Map<string, number>();
    let currentEndDate = endDate;

    while (pricesByDate.size < KIS_PRICE_POINTS_NEEDED && currentEndDate >= startDate) {
      const url = new URL(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`);
      url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
      url.searchParams.set("FID_INPUT_ISCD", ticker);
      url.searchParams.set("FID_INPUT_DATE_1", startDate);
      url.searchParams.set("FID_INPUT_DATE_2", currentEndDate);
      url.searchParams.set("FID_PERIOD_DIV_CODE", "D");
      url.searchParams.set("FID_ORG_ADJ_PRC", "1");

      const res = await enqueueKisRequest(() => fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: this.config.appKey,
          appsecret: this.config.appSecret,
          tr_id: "FHKST03010100",
          custtype: "P",
        },
      }));

      if (!res.ok) throw new Error(`KIS 시세 조회 실패 (종목 ${ticker}, HTTP ${res.status})`);
      const data = await res.json();
      const rows: Array<{ stck_bsop_date?: string; stck_clpr?: string }> = data.output2 ?? [];
      const validRows = rows
        .map((row) => ({ date: row.stck_bsop_date ?? "", close: Number(row.stck_clpr) }))
        .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0);
      if (validRows.length === 0) break;
      validRows.forEach((row) => pricesByDate.set(row.date, row.close));

      const earliestDate = validRows.reduce((earliest, row) => row.date < earliest ? row.date : earliest, validRows[0].date);
      const year = Number(earliestDate.slice(0, 4));
      const month = Number(earliestDate.slice(4, 6));
      const day = Number(earliestDate.slice(6, 8));
      currentEndDate = formatKisDate(new Date(year, month - 1, day - 1));
      if (validRows.length < 100) break;
      if (pricesByDate.size < KIS_PRICE_POINTS_NEEDED) {
        await new Promise((resolve) => setTimeout(resolve, KIS_PAGE_INTERVAL_MS));
      }
    }

    return [...pricesByDate.entries()]
      .map(([date, close]) => ({ date, close }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-KIS_PRICE_POINTS_NEEDED);
  }

  async getAsset(ticker: string): Promise<Asset> {
    const cached = this.assetCache.get(ticker);
    if (cached && Date.now() < cached.expiresAt) {
      return { ...cached.asset, historicalReturns: cached.asset.historicalReturns ? [...cached.asset.historicalReturns] : undefined };
    }
    return enqueueKisAsset(() => this.loadAsset(ticker));
  }

  private async loadAsset(ticker: string, forceRefresh = false): Promise<Asset> {
    const cached = this.assetCache.get(ticker);
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      return { ...cached.asset, historicalReturns: cached.asset.historicalReturns ? [...cached.asset.historicalReturns] : undefined };
    }

    // KIS는 가격만 주므로, 이름/섹터/fx·rate 민감도 같은 정성적 메타데이터는
    // mockData.ts에서 가져온다 (Day2에서 근거를 문서화해둔 값).
    const meta = SAMPLE_UNIVERSE.find((a) => a.ticker === ticker);
    if (!meta) {
      throw new UnknownTickerError(ticker);
    }

    const end = new Date();
    const start = new Date(end.getTime() - 550 * 24 * 60 * 60 * 1000);
    const priceSeries = await this.fetchDailyPrices(ticker, formatKisDate(start), formatKisDate(end));

    const stats = computeHistoricalStats(ticker, priceSeries);
    if (!stats) {
      throw new Error(
        `종목 ${ticker}의 KIS 데이터가 부족합니다 (관측치 ${priceSeries.length}개, 최소 ${MIN_HISTORICAL_OBSERVATIONS}개 필요).`,
      );
    }

    const asset: Asset = {
      ...meta,
      expectedAnnualReturn: stats.expectedAnnualReturn,
      annualVolatility: stats.annualVolatility,
      historicalReturns: stats.dailyReturns,
      dataSource: "historical",
    };
    this.assetCache.set(ticker, { asset, expiresAt: Date.now() + KIS_ASSET_CACHE_TTL_MS });
    return { ...asset, historicalReturns: [...stats.dailyReturns] };
  }

  preloadAssets(tickers: readonly string[]): Promise<void> {
    if (this.preloadRequest) return this.preloadRequest;
    const startedAt = Date.now();
    const request = (async () => {
      for (const ticker of tickers) {
        try {
          await enqueueKisAsset(() => this.loadAsset(ticker, true));
        } catch (error) {
          console.warn(`[KIS preload] ${ticker} 갱신 실패: ${(error as Error).message}`);
        }
      }
      console.info(`[KIS preload] 완료 (${tickers.length}종목, ${Date.now() - startedAt}ms)`);
    })();
    this.preloadRequest = request;
    void request.finally(() => {
      if (this.preloadRequest === request) this.preloadRequest = null;
    });
    return request;
  }

  async getAssets(tickers: string[]): Promise<Asset[]> {
    // KIS는 초당 호출 횟수 제한이 있어(모의투자 계좌는 특히 낮음), 병렬(Promise.all) 대신
    // 약간의 간격을 두고 순차 호출한다. 종목 수가 10개 안팎인 이 프로토타입 규모에서는
    // 체감 지연이 크지 않다.
    const results: Asset[] = [];
    for (const ticker of tickers) {
      results.push(await this.getAsset(ticker));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return results;
  }
}

export function tryCreateKisProviderFromEnv(): KisDataProvider | null {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  if (!appKey || !appSecret) return null;
  return new KisDataProvider({ appKey, appSecret, baseUrl: process.env.KIS_BASE_URL });
}

// ─────────────────────────────────────────────────────────────────────────
// 4) FallbackDataProvider — Day 4-4: 데이터 로딩 실패 대응.
//    primary가 실패하면(네트워크 오류, 데이터 없음/부족, 상장폐지 등) 조용히
//    secondary로 넘어가고, 그 결과에는 dataSource: "estimated" 표시를 남긴다.
//    종목 단위로 독립적으로 동작하므로 포트폴리오 안에 실데이터 종목과
//    추정치 종목이 섞여 있어도 전체 시뮬레이션은 정상 동작한다.
// ─────────────────────────────────────────────────────────────────────────
export class FallbackDataProvider implements AssetDataProvider {
  constructor(
    private primary: AssetDataProvider,
    private fallback: AssetDataProvider,
  ) {}

  async getAsset(ticker: string): Promise<Asset> {
    try {
      return await this.primary.getAsset(ticker);
    } catch (err) {
      console.warn(
        `[FallbackDataProvider] ${ticker} 기본 데이터 소스 실패, 추정치로 폴백: ${(err as Error).message}`,
      );
      const asset = await this.fallback.getAsset(ticker);
      return { ...asset, dataSource: "estimated" };
    }
  }

  async getAssets(tickers: string[]): Promise<Asset[]> {
    return Promise.all(tickers.map((ticker) => this.getAsset(ticker)));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 기본 프로바이더 조립: KIS(환경변수 있으면) -> CSV(파일 있으면) -> Mock 순으로
// 시도하고, 각 단계는 종목 단위로 독립적으로 폴백된다.
//
// 지금 이 저장소에는 실제 시세 CSV도, KIS 키도 없는 상태라 결과적으로는
// MockDataProvider만 동작한다(Day 3까지와 동일한 동작). KIS 키를 환경변수로
// 넣거나 data/prices.csv를 채워 넣으면 코드 변경 없이 자동으로 실데이터가
// 우선 사용된다.
// ─────────────────────────────────────────────────────────────────────────
function buildDefaultProvider(): AssetDataProvider {
  const mock = new MockDataProvider();

  const csv = tryCreateCsvProviderFromFile();
  const csvOrMock: AssetDataProvider = csv ? new FallbackDataProvider(csv, mock) : mock;

  const kis = tryCreateKisProviderFromEnv();
  if (kis) {
    void kis.preloadAssets(KIS_DEMO_TICKERS);
    const globalState = globalThis as typeof globalThis & {
      __riskTesterKisPreloadTimer?: ReturnType<typeof setInterval>;
      __riskTesterKisPreloadProvider?: KisDataProvider;
    };
    globalState.__riskTesterKisPreloadProvider = kis;
    if (!globalState.__riskTesterKisPreloadTimer) {
      globalState.__riskTesterKisPreloadTimer = setInterval(() => {
        void globalState.__riskTesterKisPreloadProvider?.preloadAssets(KIS_DEMO_TICKERS);
      }, KIS_PRELOAD_INTERVAL_MS);
      globalState.__riskTesterKisPreloadTimer.unref?.();
    }
  }
  return kis ? new FallbackDataProvider(kis, csvOrMock) : csvOrMock;
}

export const defaultDataProvider: AssetDataProvider = buildDefaultProvider();
