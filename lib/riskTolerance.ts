export type RiskToleranceEvaluation = {
  lossPct: number;
  exceededByPp: number;
  isWithinTolerance: boolean;
};

export function evaluateRiskTolerance(
  varValue: number,
  riskTolerancePct: number,
): RiskToleranceEvaluation {
  const lossPct = Math.abs(Math.min(varValue, 0)) * 100;
  const exceededByPp = Math.max(0, lossPct - riskTolerancePct);
  return { lossPct, exceededByPp, isWithinTolerance: exceededByPp === 0 };
}
