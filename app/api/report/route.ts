import { NextRequest } from "next/server";
import { generateReport, ReportLevel } from "@/lib/report/generateReport";
import { containsProhibitedDirective, SAFE_REPORT_FALLBACK } from "@/lib/report/guardrails";
import { SimulationResult, StressScenario } from "@/lib/engine/types";

export interface ReportRequestBody { scenario: StressScenario; result: SimulationResult; level: ReportLevel; }

function generationError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  const isNetworkError = /fetch failed|ENOTFOUND|ECONN|network/i.test(detail);
  return Response.json({
    error: isNetworkError ? "Gemini API 서버에 연결하지 못했습니다. 인터넷 연결과 방화벽 설정을 확인해주세요." : "Gemini API 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    ...(process.env.NODE_ENV === "development" ? { detail } : {}),
  }, { status: 502 });
}

export async function POST(req: NextRequest) {
  let body: ReportRequestBody;
  try { body = (await req.json()) as ReportRequestBody; }
  catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body.scenario || !body.result || !body.level) return Response.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "Gemini API 키가 설정되지 않았습니다." }, { status: 503 });

  console.time("Gemini");
  try {
    let report = await generateReport(body);
    if (containsProhibitedDirective(report)) {
      console.warn("AI 리포트 금지 표현 감지: 가드레일을 강화해 재생성합니다.");
      report = await generateReport(body, true);
      if (containsProhibitedDirective(report)) {
        console.error("AI 리포트 금지 표현 재감지: 안전 문구로 교체합니다.");
        report = SAFE_REPORT_FALLBACK;
      }
    }
    return new Response(report, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    console.error("리포트 생성 실패:", error);
    return generationError(error);
  } finally {
    console.timeEnd("Gemini");
  }
}
