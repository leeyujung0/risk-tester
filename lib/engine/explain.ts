import { AssetContribution, StressScenario } from "./types";

/**
 * 결과 화면에 보여줄 "왜 이 시나리오가 이렇게 영향을 주는지" 설명 텍스트를 만든다.
 * 환율/금리 충격의 일반적인 전달 경로를 설명하고, 이번 포트폴리오에서 실제로
 * 가장 큰 영향을 받은 종목을 함께 언급해 추상적인 설명이 아니라 "내 포트폴리오
 * 기준"의 설명이 되도록 한다.
 */
export function buildScenarioExplanation(
  scenario: StressScenario,
  assetContribution: AssetContribution[],
): string {
  const isBaseline = scenario.fxShockPct === 0 && scenario.rateShockPp === 0;

  if (isBaseline) {
    return "충격이 없는 평시 시나리오라 포트폴리오에 별다른 영향이 없어요.";
  }

  const parts: string[] = [];

  if (scenario.fxShockPct !== 0) {
    const dir = scenario.fxShockPct > 0 ? "약세(환율 상승)" : "강세(환율 하락)";
    parts.push(
      `원/달러 환율이 ${Math.abs(scenario.fxShockPct)}% ${dir} 방향으로 움직이는 상황을 가정했어요. ` +
        `환율이 오르면 해외 매출 비중이 큰 수출주는 원화로 환산한 이익이 늘어 유리해지고, ` +
        `원자재·부품을 수입에 의존하는 내수 업종은 비용 부담이 커져 불리해지는 경향이 있어요.`,
    );
  }

  if (scenario.rateShockPp !== 0) {
    const dir = scenario.rateShockPp > 0 ? "인상" : "인하";
    parts.push(
      `기준금리는 ${Math.abs(scenario.rateShockPp).toFixed(2)}%p ${dir}을 가정했어요. ` +
        `금리가 오르면 먼 미래의 이익을 지금 가치로 할인해서 평가하는 성장주는 밸류에이션 부담이 커지고, ` +
        `은행 등 금융주는 예대마진이 확대돼 상대적으로 유리해지는 경향이 있어요.`,
    );
  }

  if (assetContribution.length > 0) {
    const sorted = [...assetContribution].sort((a, b) => a.contributionPp - b.contributionPp);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    if (worst && best && worst.ticker !== best.ticker) {
      parts.push(
        `이번 포트폴리오에서는 ${worst.name}이(가) ${worst.contributionPp.toFixed(2)}%p로 가장 큰 타격을 받고, ` +
          `${best.name}은(는) ${best.contributionPp >= 0 ? "+" : ""}${best.contributionPp.toFixed(2)}%p로 ` +
          `상대적으로 선방할 것으로 추정돼요.`,
      );
    } else if (worst) {
      parts.push(
        `이번 포트폴리오에서는 ${worst.name}이(가) ${worst.contributionPp.toFixed(2)}%p로 가장 큰 영향을 받을 것으로 추정돼요.`,
      );
    }
  }

  return parts.join(" ");
}