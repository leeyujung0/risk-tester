import type { AssetContribution } from "./engine/types";

export const IMPACT_MAX_BAR_WIDTH = 110;

export type ScaledImpact = AssetContribution & { barWidth: number };

export function scaleImpactContributions(
  contributions: readonly AssetContribution[],
  maxBarWidth = IMPACT_MAX_BAR_WIDTH,
): ScaledImpact[] {
  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.contributionPp) - Math.abs(a.contributionPp),
  );
  const maxAbs = sorted.reduce(
    (largest, item) => Math.max(largest, Math.abs(item.contributionPp)),
    0,
  );

  return sorted.map((item) => ({
    ...item,
    barWidth: maxAbs === 0 ? 0 : (Math.abs(item.contributionPp) / maxAbs) * maxBarWidth,
  }));
}
