"use client";

interface RiskGaugeProps {
  varValue: number; // 음수 소수, 예: -0.135 (=-13.5%)
  label?: string;
}

// 게이지가 표현하는 손실률 범위: 0% ~ -25%
const GAUGE_MIN = 0;
const GAUGE_MAX = -0.25;

function clamp(v: number, min: number, max: number) {
  return Math.max(max, Math.min(min, v));
}

function riskZone(varValue: number): { label: string; color: string; dim: string } {
  if (varValue > -0.08) {
    return { label: "안전", color: "var(--signal-safe)", dim: "var(--signal-safe-dim)" };
  }
  if (varValue > -0.15) {
    return { label: "주의", color: "var(--signal-caution)", dim: "var(--signal-caution-dim)" };
  }
  return { label: "위험", color: "var(--signal-danger)", dim: "var(--signal-danger-dim)" };
}

export function RiskGauge({ varValue, label = "95% VaR" }: RiskGaugeProps) {
  const clamped = clamp(varValue, GAUGE_MIN, GAUGE_MAX);
  // 0(안전) ~ 1(최대손실)로 정규화
  const t = clamped / GAUGE_MAX; // GAUGE_MAX가 음수라 부호 정리됨: 0~1
  const angle = -180 + t * 180; // -180deg(왼쪽 끝, 0%) ~ 0deg(오른쪽 끝, -25%)
  const zone = riskZone(varValue);

  const cx = 110;
  const cy = 110;
  const r = 90;

  const needleRad = (angle * Math.PI) / 180;
  const needleX = cx + r * 0.78 * Math.cos(needleRad);
  const needleY = cy + r * 0.78 * Math.sin(needleRad);

  // 배경 트랙을 3개 구간(안전/주의/위험)으로 나눠 그림
  const arc = (startDeg: number, endDeg: number, color: string) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
        fill="none"
      />
    );
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={220} height={135} viewBox="0 0 220 135">
        {arc(-180, -114, "var(--signal-safe)")}
        {arc(-114, -54, "var(--signal-caution)")}
        {arc(-54, 0, "var(--signal-danger)")}
        {/* 바늘 */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={zone.color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill={zone.color} />
      </svg>
      <div className="-mt-2 flex flex-col items-center">
        <span
          className="font-mono-data text-3xl font-bold"
          style={{ color: zone.color }}
        >
          {(varValue * 100).toFixed(1)}%
        </span>
        <span className="text-xs text-text-muted">{label}</span>
        <span
          className="mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: zone.dim, color: zone.color }}
        >
          {zone.label} 구간
        </span>
      </div>
    </div>
  );
}
