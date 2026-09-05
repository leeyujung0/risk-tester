import { GoogleGenerativeAI } from "@google/generative-ai";
import { COMPANY_RISK_FALLBACK, pendingCompanyRisk } from "@/lib/company-risk/fallback";

type PolishedRationale = { ticker: string; rationale: string };

export async function POST(request: Request) {
  let tickers: string[];
  try {
    const body = await request.json();
    const candidates: unknown[] = Array.isArray(body.tickers) ? body.tickers : [];
    tickers = [...new Set(candidates.flatMap((ticker) => typeof ticker === "string" && ticker.trim() ? [ticker.trim()] : []))];
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (tickers.length === 0) return Response.json({ risks: [] });

  const sources = tickers.map((ticker) => COMPANY_RISK_FALLBACK.get(ticker) ?? pendingCompanyRisk(ticker));
  const completedSources = sources.filter((source) => !source.placeholder);
  let polished = new Map<string, string>();

  if (completedSources.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });
      const prompt = `다음은 사람이 이미 검토해 분류한 기업 공시 리스크입니다. 카테고리와 심각도를 새로 판단하거나 변경하지 말고 summary만 카드에 적합한 자연스러운 한국어 2~3문장으로 다듬으세요. 매수·매도 등 투자 행동을 지시하지 마세요. [{"ticker":"코드","rationale":"문장"}] JSON 배열만 반환하세요.\n${JSON.stringify(completedSources)}`;
      const text = (await model.generateContent(prompt)).response.text().replace(/^```json\s*|\s*```$/g, "");
      const parsed = JSON.parse(text) as PolishedRationale[];
      polished = new Map(parsed.filter((item) => typeof item?.ticker === "string" && typeof item?.rationale === "string").map((item) => [item.ticker, item.rationale]));
    } catch {
      polished = new Map();
    }
  }

  return Response.json({ risks: sources.map((source) => ({
    ticker: source.ticker,
    name: source.name,
    riskCategory: source.riskCategory,
    severity: source.severity,
    rationale: polished.get(source.ticker) ?? source.summary,
    sourceDate: source.sourceDate,
    pending: source.placeholder,
  })) });
}
