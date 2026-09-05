# BACKEND_CONTRACT.md
## Codex에게: 이 문서는 "절대 변경 금지" 계약이다

이 프로젝트는 이미 몬테카를로 시뮬레이션 엔진, 시나리오 빌더, AI 리포트 생성 로직이
완성되어 실제로 작동하고 있다. 지금 요청하는 작업은 **피그마 디자인을 픽셀 단위로
재현하는 UI 리디자인**이며, 아래 정의된 API 요청/응답 형식·상태 변수·함수 시그니처는
**절대로 바꾸지 말 것**. 이 인터페이스에 맞춰 컴포넌트의 마크업/스타일/레이아웃만
새로 짜라.

계산 로직 파일(`lib/engine/*`, `lib/report/*`)과 API 라우트(`app/api/*/route.ts`)의
로직은 건드리지 말고, import 경로 조정 정도만 허용한다.

---

## 1. API 엔드포인트

### POST /api/simulate

요청:
```ts
interface SimulateRequestBody {
  holdings: { ticker: string; weight: number }[];
  // weight = 종목별 투자 금액(원) 또는 상대 비중. 엔진이 합계 기준으로 자동
  // 정규화하므로, 피그마처럼 "4,000,000 ₩" 같은 절대 원화 금액을 그대로 넣어도 된다.
  fxShockPct: number;   // 환율 충격(%). 예: +8 = 환율 8% 상승(원화 약세)
  rateShockPp: number;  // 기준금리 충격(%p). 예: +0.5
  horizonDays?: number; // 생략 시 HORIZON_OPTIONS[0]의 값을 서버가 기본 적용
}
```

응답(200):
```ts
interface SimulateResponse {
  scenario: StressScenario;
  result: SimulationResult;
  baselineVar: number;          // 평시(충격 없음) 시나리오의 VaR
  additionalVarLossPp: number;  // 평시 대비 이 시나리오로 인한 "추가 손실" (%p, 항상 0 이상)
  estimatedTickers: string[];   // 실데이터 대신 추정치를 쓴 종목 코드. 비어있지 않으면
                                 // UI에 "추정치 사용 중" 경고를 표시해야 함
}
```

응답(400, 에러): `{ error: string }`

### POST /api/report

요청:
```ts
interface ReportRequestBody {
  scenario: StressScenario;
  result: SimulationResult;
  level: "beginner" | "intermediate";
}
```

응답(200): `{ report: string }` — 마크다운 기호 없는 평문, 3~5문장
응답(500, 에러): `{ error: string }`

---

## 2. 핵심 타입 (lib/engine/types.ts)

> ⚠️ Day 3~4 리팩터링(데이터 프로바이더 추상화)을 거치면서 필드가 추가됐을 수 있음.
> 아래는 그 시점까지 확인된 구조이며, 실제 파일과 반드시 대조할 것.

```ts
interface Asset {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  expectedAnnualReturn: number;
  annualVolatility: number;
  fxSensitivity: number;
  rateSensitivity: number;
  dataSource?: "real" | "estimated"; // Day 4에서 추가된 필드
}

interface StressScenario {
  id: string;
  label: string;
  description: string;
  fxShockPct: number;
  rateShockPp: number;
  volMultiplier: number;
  correlationBump: number;
}

interface AssetContribution {
  ticker: string;
  name: string;
  weight: number;
  contributionPp: number;       // 포트폴리오 수익률 기여도(%p) — 피그마의 "+1.09pp" 표기
  standaloneShockReturn: number;
}

interface SimulationResult {
  finalReturns: number[];       // 손실분포 히스토그램 렌더링에 사용 (약 8,000개)
  maxDrawdowns: number[];
  var: number;                  // 음수 소수. 예: -0.203 = "-20.3%"
  cvar: number;
  expectedMDD: number;
  worstMDD: number;
  medianReturn: number;
  assetContribution: AssetContribution[];
}
```

---

## 3. 프론트엔드 상태 변수 (변수명·타입 유지, 값 표시 방식만 디자인에 맞게 조정)

```ts
// 포트폴리오 입력 — 피그마의 종목별 파스텔 카드 + 금액 입력에 대응
const [holdings, setHoldings] =
  useState<{ ticker: string; weight: number }[]>([...]);

// 시나리오 슬라이더 — 피그마의 "환율 충격 시나리오" / "금리 충격 시나리오" 슬라이더에 대응
const [fxShockPct, setFxShockPct] = useState<number>(8);
// 슬라이더 범위: -10 ~ +150 (피그마 하단 라벨 "-10% / +8% / +150%" 기준)
const [rateShockPp, setRateShockPp] = useState<number>(0.5);
// 슬라이더 범위: -2.00 ~ +16.00 (피그마 하단 라벨 "-2.00%p / +0.50%p / +16.00%p" 기준)

// 시뮬레이션 기간 — 피그마의 "1개월 / 3개월 / 6개월" 버튼에 대응
const [horizonId, setHorizonId] =
  useState<string>(HORIZON_OPTIONS[0].id);

// 시뮬레이션 결과
const [result, setResult] = useState<SimulationResult | null>(null);
const [scenario, setScenario] = useState<StressScenario | null>(null);
const [baselineVar, setBaselineVar] = useState<number | null>(null);
const [additionalVarLossPp, setAdditionalVarLossPp] =
  useState<number | null>(null);
const [estimatedTickers, setEstimatedTickers] = useState<string[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// AI 맞춤 해설 리포트 — 피그마의 아바타+말풍선 UI에 대응
const [reportLevel, setReportLevel] =
  useState<"beginner" | "intermediate">("beginner");
const [report, setReport] = useState<string | null>(null);
const [reportLoading, setReportLoading] = useState(false);
const [reportError, setReportError] = useState<string | null>(null);
```

---

## 4. 이벤트 핸들러 (함수 시그니처 유지, 내부 fetch 로직 그대로 사용)

```ts
async function runSimulation(): Promise<void>
// POST /api/simulate 호출. holdings, fxShockPct, rateShockPp, horizonDays 전송.
// 성공 시 result/scenario/baselineVar/additionalVarLossPp/estimatedTickers 갱신.
// 새로 호출할 때 이전 report는 초기화(setReport(null)) 할 것.

async function generateReport(): Promise<void>
// POST /api/report 호출. result, scenario, reportLevel 전송.
// result 또는 scenario가 null이면 호출하지 않음(가드 필요).

function addHolding(ticker: string): void
function removeHolding(ticker: string): void
function updateHoldingAmount(ticker: string, amount: number): void
// 피그마의 "+ 카카오" "+ 포스코" 같은 캐러셀 칩 클릭 시 addHolding 호출,
// 각 보유종목 카드의 금액 입력 필드 변경 시 updateHoldingAmount 호출.
```

---

## 5. 역사적 프리셋 버튼 (피그마 노출값 기준 — 반드시 실제 파일과 대조)

> ⚠️⚠️ 아래 수치는 스크린샷에서 육안으로 읽은 추정치다. `/* 확인 필요 */`로
> 표시한 값은 실제 코드(예: `lib/engine/historicalPresets.ts` 또는
> `scenarioBuilder.ts` 안의 앵커 정의)를 열어서 정확한 숫자로 반드시 교체할 것.
> 값이 틀리면 프리셋 버튼을 눌렀을 때 시나리오 설명과 실제 계산 결과가 어긋난다.

```ts
const FX_PRESETS = [
  { id: "baseline", label: "평시", fxShockPct: 0 },
  { id: "legoland-2022", label: "2022년 레고랜드 사태 수준", fxShockPct: 8 },
  { id: "gfc-2008", label: "2008년 글로벌 금융위기 수준", fxShockPct: /* 확인 필요 */ 0 },
  { id: "imf-1997", label: "1997년 외환위기 수준", fxShockPct: /* 확인 필요, 슬라이더 최댓값(+150%)에 근접한 값으로 추정 */ 0 },
];

const RATE_PRESETS = [
  { id: "baseline", label: "평시", rateShockPp: 0 },
  { id: "bigstep-2022", label: "2022년 빅스텝 1회 수준", rateShockPp: 0.5 },
  { id: "tightening-2022", label: "2022년 한 해 누적 긴축 수준", rateShockPp: /* 확인 필요 */ 0 },
  { id: "imf-1997", label: "1997년 외환위기 수준", rateShockPp: /* 확인 필요, 슬라이더 최댓값(+16.00%p)에 근접한 값으로 추정 */ 0 },
];
```

---

## 6. 절대 건드리면 안 되는 파일

- `lib/engine/monteCarlo.ts`, `statistics.ts`, `scenarioBuilder.ts`(또는 `historicalPresets.ts`), `dataProvider.ts`, `horizon.ts`
- `lib/report/generateReport.ts`
- `app/api/simulate/route.ts`, `app/api/report/route.ts`
  (내용 변경 금지. 새 컴포넌트 구조에 맞춘 import 경로 조정만 허용)

---

## 7. 이번 작업 범위에서 제외되는 것

- **회원가입/로그인 기능은 이번 작업에 포함하지 않는다.** 피그마 상단의
  "회원가입 / 로그인" 버튼은 **시각적 요소로만** 배치하고, 실제 인증 로직은
  연결하지 말 것 (별도 작업으로 진행 예정: Supabase Auth + 포트폴리오 저장/불러오기).
- 피그마 하단의 "사용자 리뷰" 섹션은 정적 텍스트로 유지해도 무방 (실제 리뷰
  데이터 연동 불필요).
- 피그마 마지막 화면의 "연락처"(이름/성/이메일) 폼은 실제 기능이 필요한지
  불명확 — 일단 시각 요소로만 두고, 실제 제출 로직은 연결하지 말 것.

---

## 8. Codex에게 주는 최종 지시 요약

1. 위 API/타입/상태변수/함수 시그니처를 **절대 변경하지 말 것**.
2. 첨부된 피그마 디자인의 색상·타이포·레이아웃·컴포넌트 구조를 최대한 그대로 재현할 것.
3. 각 UI 요소를 위에 정의된 정확한 상태변수·핸들러에 연결(wiring)할 것.
4. 5번 섹션의 프리셋 수치는 실제 파일 값으로 반드시 교체할 것 (커밋 전 필수 확인 항목).
5. 6번 섹션의 파일들은 내용을 수정하지 말 것.
6. 7번 섹션의 항목(로그인/리뷰/연락처)은 시각적 placeholder로만 남길 것.
