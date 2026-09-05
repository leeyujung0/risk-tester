# Day 4: 실제 시세 데이터 연동 현황

## 지금 상태 (2026-08 기준)

이 프로젝트는 **아직 실제 시세 데이터 없이** 동작한다. `lib/engine/mockData.ts`의
목업 통계치(정성적 근사치)로 시뮬레이션이 돌아가는 Day 3까지의 상태 그대로다.

다만 Day 4에서 실제 데이터가 들어왔을 때 **코드를 고칠 필요 없이 자동으로
전환되도록** 파이프라인 전체를 만들어뒀다:

```
KIS API (환경변수 있으면)
   ↓ 실패 시
CSV 파일 (data/prices.csv 있으면)
   ↓ 실패 시
목업 데이터 (항상 성공, 최종 폴백)
```

각 단계는 **종목 단위로 독립적으로** 폴백된다. 예를 들어 10종목 중 8종목은
KIS에서 정상적으로 받아오고 2종목만 실패해도, 그 2종목만 CSV나 목업으로
대체되고 나머지는 실데이터로 시뮬레이션된다. 어떤 종목이 추정치로 대체됐는지는
결과 화면에 "⚠️ 추정치 사용 중" 배너로 표시된다.

## 사용자가 직접 해야 하는 일

### 1. KIS Open API 키 발급 (실시간 연동을 원하는 경우)

1. https://apiportal.koreainvestment.com 가입
2. "앱 등록"으로 앱키(App Key)/앱시크릿(App Secret) 발급
   - 모의투자 계좌로도 발급 가능 (일봉 조회는 모의투자로도 됨)
3. 프로젝트 루트에 `.env.local` 파일을 만들고 `.env.example`을 참고해서
   `KIS_APP_KEY`, `KIS_APP_SECRET` 값을 채워 넣기
4. `npm run dev`로 실행하면 `lib/engine/dataProvider.ts`의
   `defaultDataProvider`가 자동으로 KIS를 먼저 시도한다

**⚠️ 중요**: `lib/engine/dataProvider.ts`의 `KisDataProvider`는 KIS의 공개된
API 문서 구조(엔드포인트, `tr_id`, 응답 필드명 등)를 기반으로 작성했지만,
이 환경은 외부 네트워크가 막혀 있어 실제 키로 호출 테스트를 해본 적이 없다.
처음 실행할 때 아래를 확인해서 필요하면 직접 조정해야 할 수 있다:

- `getAccessToken()`의 `/oauth2/tokenP` 요청/응답 형식
- `fetchDailyPrices()`의 `tr_id`("FHKST03010100"), 쿼리 파라미터명
- 응답 파싱: `data.output2` 배열 안의 `stck_bsop_date`(날짜), `stck_clpr`(종가)
  필드명

콘솔에 에러 메시지가 그대로 로그로 남도록 만들어뒀으니(`console.warn` in
`FallbackDataProvider`), 브라우저 개발자도구가 아니라 **서버(터미널) 콘솔**을
보면 KIS 쪽에서 정확히 어떤 응답이 왔는지 확인할 수 있다.

### 2. (대안) CSV로 과거 시세 넣기

KIS 인증이 번거롭거나 급하게 확인만 하고 싶으면, 아래 형식의 CSV를
`data/prices.csv`에 넣기만 하면 된다 (여러 종목이 한 파일에 섞여 있어도 됨):

```csv
date,ticker,close
2024-01-02,005930,78500
2024-01-03,005930,79200
2024-01-02,000660,132000
...
```

- 종목당 최소 60개 거래일치(`MIN_HISTORICAL_OBSERVATIONS`, `csvPriceParser.ts`)
  데이터가 있어야 "실제 데이터"로 인정되고, 그보다 적으면 그 종목만 목업으로
  폴백된다.
- 종목코드는 `mockData.ts`의 10개 종목(`005930`, `000660`, `035420`, `035720`,
  `005380`, `051910`, `105560`, `055550`, `035900`, `017670`)과 일치해야 한다
  (이름/섹터/fx·rate 민감도 같은 정성적 메타데이터는 여전히 `mockData.ts`에서
  가져오고, 가격 시계열만 CSV로 교체하는 구조라서).

### 3. fxSensitivity / rateSensitivity 실측 검증 (선택)

`mockData.ts`의 환율/금리 민감도는 아직 정성적 근거(코드 주석 참고)로만
채워져 있다. 실제 시세 CSV와 원/달러 환율 CSV가 준비되면:

```bash
npx tsx scripts/estimateSensitivities.ts data/prices.csv data/usdkrw.csv 2022-09-01 2022-11-15
```

특정 기간(예: 2022년 레고랜드 사태 전후) 동안 종목별 일별수익률을 환율
일별변화율에 회귀분석해서 베타와 R²를 출력한다. 이 값을 참고해서
`mockData.ts`의 `fxSensitivity` 주석/값을 갱신하면 된다.

## Day 4 완료 기준 대비 현황

| 항목 | 상태 |
|---|---|
| KISDataProvider/HistoricalCsvDataProvider 구현 | ✅ 완료 (`lib/engine/dataProvider.ts`) |
| 실제 상관계수 계산으로 교체 (섹터 규칙은 폴백) | ✅ 완료 (`monteCarlo.ts`의 `buildCorrelationMatrix`) |
| fxSensitivity/rateSensitivity 검증 도구 | ✅ 완료 (`scripts/estimateSensitivities.ts`), 실측 실행은 미완료 |
| 데이터 로딩 실패 폴백 + "추정치 사용 중" 안내 | ✅ 완료 (`FallbackDataProvider` + 결과 화면 배너) |
| 최소 10개 종목이 **실제 데이터 기반**으로 시뮬레이션 | ❌ 미완료 — 이 환경에서 실제 시세를 확보할 방법이 없었음 |

마지막 항목만 사용자가 위 1번 또는 2번을 완료해야 채워진다. 나머지는 전부
지금 상태에서 바로 검증 가능하다 (`npm test`).
