import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRiskTolerance } from "../riskTolerance";

test("음수 VaR 손실률이 허용 범위를 초과하면 초과분을 계산한다", () => {
  assert.deepEqual(evaluateRiskTolerance(-0.18, 15), {
    lossPct: 18,
    exceededByPp: 3,
    isWithinTolerance: false,
  });
});

test("허용 범위 경계값은 범위 안으로 처리한다", () => {
  assert.equal(evaluateRiskTolerance(-0.15, 15).isWithinTolerance, true);
});

test("양수 VaR는 손실 0으로 처리한다", () => {
  assert.deepEqual(evaluateRiskTolerance(0.05, 10), {
    lossPct: 0,
    exceededByPp: 0,
    isWithinTolerance: true,
  });
});
