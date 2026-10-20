const GAUGE_COLORS = ['#E8231F', '#F7741F', '#FDC010', '#C6D52A', '#7CC242', '#2EA44F'];
const CX = 50, CY = 50, R = 36, W = 16;

const point = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(rad)).toFixed(2)} ${(CY - R * Math.sin(rad)).toFixed(2)}`;
};

const SEGMENTS = GAUGE_COLORS.map((color, i) => {
  const step = 180 / GAUGE_COLORS.length;
  return { color, d: `M ${point(180 - i * step)} A ${R} ${R} 0 0 1 ${point(180 - (i + 1) * step)}` };
});

export function TemperatureGauge({ value, width = 26, height = 18 }: { value: number; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 70" fill="none" aria-hidden="true" className="shrink-0">
      <ellipse cx="50" cy="66" rx="34" ry="3" fill="currentColor" opacity="0.08" />
      {SEGMENTS.map(s => <path key={s.color} d={s.d} stroke={s.color} strokeWidth={W} />)}
      <circle cx={CX - R} cy={CY} r={W / 2} fill={GAUGE_COLORS[0]} />
      <circle cx={CX + R} cy={CY} r={W / 2} fill={GAUGE_COLORS[GAUGE_COLORS.length - 1]} />
      <g transform={`rotate(${(value / 100) * 180 - 90} ${CX} ${CY})`}>
        <path d="M 46.5 50 L 48.9 18 Q 50 14 51.1 18 L 53.5 50 Z" fill="currentColor" opacity="0.8" />
      </g>
      <circle cx={CX} cy={CY} r="7" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
