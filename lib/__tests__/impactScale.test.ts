import assert from "node:assert/strict";
import { test } from "node:test";
import type { AssetContribution } from "../engine/types";
import { IMPACT_MAX_BAR_WIDTH, scaleImpactContributions } from "../impactScale";

const contribution = (ticker: string, contributionPp: number): AssetContribution => ({
  ticker,
  name: ticker,
  weight: 1,
  contributionPp,
  standaloneShockReturn: contributionPp / 100,
});

test("0개 종목은 빈 배열을 반환한다", () => {
  assert.deepEqual(scaleImpactContributions([]), []);
});

test("1개 종목은 최대 막대 폭을 사용한다", () => {
  const rows = scaleImpactContributions([contribution("A", -2)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].barWidth, IMPACT_MAX_BAR_WIDTH);
});

test("2개 종목은 절댓값 순으로 정렬하고 비례 스케일링한다", () => {
  const rows = scaleImpactContributions([contribution("A", 1), contribution("B", -2)]);
  assert.deepEqual(rows.map((row) => row.ticker), ["B", "A"]);
  assert.deepEqual(rows.map((row) => row.barWidth), [110, 55]);
});

test("3개 이상 종목도 자르지 않고 모두 반환한다", () => {
  const rows = scaleImpactContributions([
    contribution("A", 0.5), contribution("B", -4),
    contribution("C", 1), contribution("D", -2),
  ]);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.ticker), ["B", "D", "C", "A"]);
  assert.deepEqual(rows.map((row) => row.barWidth), [110, 55, 27.5, 13.75]);
});

test("동률과 모든 기여도 0을 안전하게 처리한다", () => {
  const tied = scaleImpactContributions([contribution("A", 2), contribution("B", -2)]);
  assert.deepEqual(tied.map((row) => row.barWidth), [110, 110]);

  const zero = scaleImpactContributions([contribution("A", 0), contribution("B", 0)]);
  assert.deepEqual(zero.map((row) => row.barWidth), [0, 0]);
});
