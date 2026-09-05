const PROHIBITED_DIRECTIVE_PATTERNS = [
  /매수\s*(?:하세요|하십시오|해라|해야\s*합니다)/,
  /매도\s*(?:하세요|하십시오|해라|해야\s*합니다)/,
  /(?:사세요|파세요)/,
  /비중(?:을|은)?\s*(?:늘리|줄이|조정)[^.!?\n]*(?:하세요|하십시오|권합니다|추천합니다)/,
];

export const SAFE_REPORT_FALLBACK = "AI 리포트가 투자 행동을 지시하는 표현을 반복 생성해 안전상 표시하지 않았습니다. 화면의 통계적 위험 지표를 참고하되, 최종 투자 판단은 사용자 본인의 몫입니다.";

export function containsProhibitedDirective(text: string): boolean {
  return PROHIBITED_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text));
}
