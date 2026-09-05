import { NextRequest, NextResponse } from "next/server";
import { runStressSimulation } from "@/lib/engine/monteCarlo";
import { buildCustomScenario } from "@/lib/engine/scenarioBuilder";
import { defaultDataProvider, UnknownTickerError } from "@/lib/engine/dataProvider";
import { isValidHorizonDays, HORIZON_OPTIONS } from "@/lib/engine/horizon";
import { Asset } from "@/lib/engine/types";

export interface SimulateRequestBody {
  holdings: { ticker: string; weight: number }[];
  fxShockPct: number; // 원/달러 환율 충격 (%)
  rateShockPp: number; // 기준금리 충격 (%p)
  horizonDays?: number;
}

const NUM_SIMULATIONS = 8000;
const CONFIDENCE_LEVEL = 0.95;

export async function POST(req: NextRequest) {
  const body: SimulateRequestBody = await req.json();

  if (!body.holdings || body.holdings.length === 0) {
    return NextResponse.json(
      { error: "보유 종목을 최소 1개 이상 입력해주세요." },
      { status: 400 },
    );
  }

  const hasInvalidWeight = body.holdings.some(
    (h) => typeof h.weight !== "number" || !Number.isFinite(h.weight) || h.weight < 0,
  );
  if (hasInvalidWeight) {
    return NextResponse.json(
      { error: "투자 금액(비중) 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (typeof body.fxShockPct !== "number" || typeof body.rateShockPp !== "number") {
    return NextResponse.json(
      { error: "환율/금리 충격 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const horizonDays = body.horizonDays ?? HORIZON_OPTIONS[0].horizonDays;
  if (!isValidHorizonDays(horizonDays)) {
    return NextResponse.json(
      { error: "시뮬레이션 기간 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  // Day 3: SAMPLE_UNIVERSE를 직접 참조하지 않고 AssetDataProvider를 통해서만 종목
  // 데이터를 가져온다. Day 4에서 KIS 기반 프로바이더로 바꿔도 이 아래 코드는 그대로다.
  let baseAssets: Asset[];
  try {
    baseAssets = await defaultDataProvider.getAssets(body.holdings.map((h) => h.ticker));
  } catch (e) {
    const message = e instanceof UnknownTickerError ? e.message : "종목 데이터를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const weightByTicker = new Map(body.holdings.map((h) => [h.ticker, h.weight]));
  const assets: Asset[] = baseAssets.map((a) => ({
    ...a,
    weight: weightByTicker.get(a.ticker) ?? 0,
  }));

  // Day 4-4: 실데이터 대신 추정치(mock/섹터 평균)로 폴백된 종목이 있으면 프런트에서
  // "추정치 사용 중" 안내를 띄울 수 있도록 목록을 함께 내려준다.
  const estimatedTickers = assets.filter((a) => a.dataSource === "estimated").map((a) => a.ticker);

  const scenario = buildCustomScenario({
    fxShockPct: body.fxShockPct,
    rateShockPp: body.rateShockPp,
  });

  let result;
  try {
    result = runStressSimulation(
      { assets },
      scenario,
      { numSimulations: NUM_SIMULATIONS, horizonDays, confidenceLevel: CONFIDENCE_LEVEL },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "시뮬레이션 실행 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Day 3-4: "평시 대비 이 시나리오로 인한 추가 손실"을 보여주기 위해 충격 없는
  // baseline(평시) 시나리오도 같은 포트폴리오·기간으로 한 번 더 돌려 VaR을 비교한다.
  const baselineScenario = buildCustomScenario({ fxShockPct: 0, rateShockPp: 0 });
  const baselineResult = runStressSimulation(
    { assets },
    baselineScenario,
    { numSimulations: NUM_SIMULATIONS, horizonDays, confidenceLevel: CONFIDENCE_LEVEL },
  );
  // 항상 0 이상의 "추가로 더 잃는 정도(%p)"로 표현 (평시보다 시나리오가 덜 나쁘게
  // 나오는 경우는 없다고 가정하지만, 방어적으로 0 미만이 되지 않게 클램프).
  const additionalVarLossPp = Math.max(0, (baselineResult.var - result.var) * 100);

  return NextResponse.json({
    scenario,
    result,
    baselineVar: baselineResult.var,
    additionalVarLossPp,
    estimatedTickers,
  });
}
