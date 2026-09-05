import assert from "node:assert/strict";
import test from "node:test";
import { containsProhibitedDirective } from "../guardrails";

test("직접적인 매매 지시를 감지한다", () => {
  for (const text of ["삼성전자를 매수하세요.", "지금 매도하십시오.", "이 종목을 사세요.", "보유분을 파세요.", "해당 종목 비중을 줄이는 것을 권합니다."]) {
    assert.equal(containsProhibitedDirective(text), true, text);
  }
});

test("구조적인 위험 설명은 허용한다", () => {
  assert.equal(containsProhibitedDirective("환율 상승은 수입 비용을 높여 수익성에 부담이 될 수 있습니다."), false);
  assert.equal(containsProhibitedDirective("최종 투자 판단은 사용자 본인의 몫입니다."), false);
});
