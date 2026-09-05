import { GoogleGenerativeAI } from "@google/generative-ai";
import { SimulationResult, StressScenario } from "@/lib/engine/types";

export type ReportLevel = "beginner" | "intermediate";

export interface ReportRequest {
  scenario: StressScenario;
  result: SimulationResult;
  level: ReportLevel;
}

function formatPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function pickNotableContributions(result: SimulationResult) {
  const sorted = [...result.assetContribution].sort(
    (a, b) => a.contributionPp - b.contributionPp,
  );
  const worst = sorted.slice(0, 2);
  const best = sorted.slice(-2).reverse();
  const merged = [...worst, ...best].filter(
    (v, i, arr) => arr.findIndex((x) => x.ticker === v.ticker) === i,
  );
  return merged;
}

function buildKoreanPrompt(req: ReportRequest, reinforceGuardrail = false): string {
  const { scenario, result, level } = req;
  const contributions = pickNotableContributions(result)
    .map((asset) => `- ${asset.name} (비중 ${(asset.weight * 100).toFixed(0)}%): ${asset.contributionPp >= 0 ? "+" : ""}${asset.contributionPp.toFixed(2)}%p 영향`)
    .join("\n");
  const levelGuide = level === "beginner"
    ? "금융 용어를 최소화하고 일상적인 표현으로 쉽게 설명하세요. VaR, CVaR, MDD는 뜻을 바로 풀어 쓰세요."
    : "기본적인 금융 개념을 안다고 가정하고 수치와 위험 요인을 조금 더 분석적으로 설명하세요.";

  return `당신은 개인 투자자에게 위험을 설명하는 친절한 금융 해설가입니다.
아래 수치는 몬테카를로 시뮬레이션으로 계산된 포트폴리오 스트레스 테스트 결과입니다. 제공된 수치만 사용하고 새로운 수치를 만들어내지 마세요.

[시나리오]
${scenario.label}
${scenario.description}

[위험 지표]
- VaR(95%): ${formatPct(result.var)}
- CVaR(95%, 극단 손실 평균): ${formatPct(result.cvar)}
- 평균 MDD: ${formatPct(result.expectedMDD)}
- 최악 MDD(5%tile): ${formatPct(result.worstMDD)}
- 중앙값 수익률: ${formatPct(result.medianReturn)}

[종목별 영향]
${contributions}

[설명 수준]
${level === "beginner" ? "초보자" : "중급자"}

[작성 지침]
${levelGuide}
특정 종목의 매수, 매도 또는 비중 조정을 지시하거나 권유하는 표현을 절대 쓰지 마세요. 왜 위험한지 구조적으로 설명하되, 결정은 사용자 몫으로 남기세요.
${reinforceGuardrail ? "이전 응답에 투자 행동을 지시하는 표현이 포함되었습니다. 매수하세요, 매도하세요, 사세요, 파세요, 비중을 늘리거나 줄이라는 문구를 포함하지 말고 위험의 원인만 설명하세요." : ""}
자연스러운 한국어로 3~5문장을 작성하세요. 전체 위험 수준, 손실과 완충에 기여한 종목, 투자자가 참고할 점을 설명하세요. 투자 권유처럼 단정하지 말고 마크다운 기호 없이 하나의 자연스러운 문단으로 작성하세요.`;
}

export async function generateReport(req: ReportRequest, reinforceGuardrail = false): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });

  const prompt = buildKoreanPrompt(req, reinforceGuardrail);
  const response = await model.generateContent(prompt);
  return response.response.text();
}
