/**
 * 표준정규분포 난수 생성 (Box-Muller 변환)
 */
export function randomNormal(): number {
  let u1 = 0;
  let u2 = 0;
  // 0을 피하기 위해 재시도 (log(0) 방지)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * 공분산 행렬의 Cholesky 분해 (하삼각행렬 L, 즉 Cov = L * L^T)
 * 상관된 난수를 생성하기 위해 사용: correlated = L * independentStandardNormals
 *
 * Day 3 견고성 보강: 같은 섹터 종목만 모여 상관계수가 1에 가까워지는 경우
 * 공분산 행렬이 거의 특이(singular)해져 대각원소가 0에 아주 가까워질 수 있다.
 * 부동소수점 오차까지 겹치면 그 값이 아주 작은 음수로 계산되기도 하는데,
 * 이를 그대로 두면 sqrt(음수) = NaN이 되어 시뮬레이션 전체가 깨진다.
 * 아래 두 가지 안전장치를 둔다:
 *  1) diagonal regularization: 대각원소에 아주 작은 값(1e-9)을 더해 행렬을
 *     수치적으로 조금 더 "양의 정부호"에 가깝게 만든다 (결과에 미치는 영향은 무시할 수준).
 *  2) Math.max(val, EPS): 그래도 음수가 나오면 0에 가까운 아주 작은 양수로 클램프해
 *     NaN이 발생하지 않도록 방어한다.
 */
const CHOLESKY_DIAGONAL_JITTER = 1e-9;
const CHOLESKY_MIN_PIVOT = 1e-12;

export function choleskyDecomposition(covMatrix: number[][]): number[][] {
  const n = covMatrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = covMatrix[i][i] + CHOLESKY_DIAGONAL_JITTER - sum;
        L[i][j] = Math.sqrt(Math.max(val, CHOLESKY_MIN_PIVOT)); // 수치오차로 음수가 되는 것 방지
      } else {
        L[i][j] = (covMatrix[i][j] - sum) / (L[j][j] || CHOLESKY_MIN_PIVOT);
      }
    }
  }
  return L;
}

/**
 * 상관계수 행렬 + 개별 변동성 벡터 -> 공분산 행렬
 */
export function correlationToCovariance(
  correlation: number[][],
  volatilities: number[],
): number[][] {
  const n = volatilities.length;
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = correlation[i][j] * volatilities[i] * volatilities[j];
    }
  }
  return cov;
}

/**
 * 위기 상황에서 상관관계가 높아지는 현상(correlation breakdown)을 반영.
 * bump 값만큼 비대각 상관계수를 1 방향으로 끌어올리되 1을 넘지 않게 클램프.
 */
export function bumpCorrelation(
  correlation: number[][],
  bump: number,
): number[][] {
  const n = correlation.length;
  const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        result[i][j] = 1;
      } else {
        const bumped = correlation[i][j] + bump * (1 - correlation[i][j]);
        result[i][j] = Math.min(0.98, bumped);
      }
    }
  }
  return result;
}

export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const clampedP = Math.min(1, Math.max(0, p));
  const idx = (sortedArr.length - 1) * clampedP;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  const weight = idx - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

/**
 * Day 4: 두 수익률 시계열 간 표본 피어슨 상관계수.
 * 실제 과거 가격 데이터가 있는 종목 쌍의 "진짜" 상관관계를 계산하는 데 사용
 * (Day 3까지는 섹터 기반 규칙으로만 추정했음).
 * 길이가 다르면 앞에서부터 겹치는 구간만 사용하고, 데이터가 너무 짧으면(< 2)
 * NaN 대신 0을 반환해 호출부에서 섹터 기반 폴백으로 넘어갈 수 있게 한다.
 */
export function sampleCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const x = a.slice(0, n);
  const y = b.slice(0, n);
  const meanX = mean(x);
  const meanY = mean(y);
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return 0; // 둘 중 하나라도 완전히 변동이 없으면 상관계수 정의 불가 -> 0(무관)으로 처리
  const r = cov / denom;
  return Math.min(1, Math.max(-1, r)); // 부동소수점 오차로 [-1,1] 범위를 벗어나는 것 방지
}

/**
 * Day 4: 단순 선형회귀(OLS) y = alpha + beta * x.
 * fxSensitivity/rateSensitivity를 실제 데이터로 추정할 때 재사용하기 위한
 * 범용 유틸리티 (scripts/estimateSensitivities.ts에서 사용).
 */
export interface RegressionResult {
  beta: number;
  alpha: number;
  rSquared: number;
  n: number;
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { beta: 0, alpha: 0, rSquared: 0, n };
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const meanX = mean(xs);
  const meanY = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
  }
  const beta = sxx === 0 ? 0 : sxy / sxx;
  const alpha = meanY - beta * meanX;
  const r = sampleCorrelation(xs, ys);
  return { beta, alpha, rSquared: r * r, n };
}
