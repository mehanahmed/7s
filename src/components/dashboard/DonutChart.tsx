"use client";

import React, { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface DonutDatum {
  name: string;
  value: number;
  /** fixed colour (e.g. a brand colour); falls back to the palette */
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  /** big number in the hole (defaults to the total) */
  centerValue?: React.ReactNode;
  /** Show the hovered slice's share of leads, or the largest slice by default. */
  showLeadPercentage?: boolean;
  /** small caps line under it */
  centerLabel?: string;
  className?: string;
}

/** Slice colours, in the order of the reference design. */
export const DONUT_PALETTE = ['#E8408E', '#1C2B8F', '#22D3D8', '#0A7DE8', '#7B4BB7', '#F59E0B', '#10B981', '#EF4444'];

const SIZE = 300;
const C = SIZE / 2;
const R_OUT = 138;
const R_IN = 74;
const GAP = 3; // px between slices

const polar = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;

/** Annular sector from angle a0 to a1 (radians, clockwise from 12 o'clock). */
function sector(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(R_OUT, a0);
  const [x1, y1] = polar(R_OUT, a1);
  const [x2, y2] = polar(R_IN, a1);
  const [x3, y3] = polar(R_IN, a0);
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`;
}

const fullRing = () =>
  `M${C - R_OUT} ${C} A${R_OUT} ${R_OUT} 0 1 1 ${C + R_OUT} ${C} A${R_OUT} ${R_OUT} 0 1 1 ${C - R_OUT} ${C} Z ` +
  `M${C - R_IN} ${C} A${R_IN} ${R_IN} 0 1 0 ${C + R_IN} ${C} A${R_IN} ${R_IN} 0 1 0 ${C - R_IN} ${C} Z`;

/**
 * Donut with a legend on the right (below on small screens): square legend markers,
 * the percentage printed inside each slice, a soft shadow around the hole and a slice that lifts out on hover.
 */
export function DonutChart({ data, centerValue, showLeadPercentage = false, centerLabel = 'TOTAL', className }: DonutChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const slices = useMemo(() => {
    if (total <= 0) return [];
    let acc = -Math.PI / 2;
    return data.map((d, i) => {
      const span = (d.value / total) * Math.PI * 2;
      const a0 = acc;
      const a1 = acc + span;
      acc = a1;
      const pad = data.length > 1 ? GAP / ((R_OUT + R_IN) / 2) / 2 : 0;
      const mid = (a0 + a1) / 2;
      return { ...d, i, a0: a0 + pad, a1: a1 - pad, mid, span, color: d.color ?? DONUT_PALETTE[i % DONUT_PALETTE.length], pct: (d.value / total) * 100 };
    });
  }, [data, total]);

  if (!slices.length) return null;

  const activeSlice = (hover !== null ? slices[hover] : undefined)
    ?? slices.reduce((largest, slice) => slice.value > largest.value ? slice : largest);
  const displayedValue = showLeadPercentage
    ? `${Number(activeSlice.pct.toFixed(2))}%`
    : centerValue ?? total;

  return (
    <div className={cn('flex w-full flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10', className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full max-w-[260px] shrink-0 overflow-visible" role="img" aria-label="Donut chart">
        <defs>
          <filter id={`${uid}-lift`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.38" />
          </filter>
          <filter id={`${uid}-hole`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.28" />
          </filter>
        </defs>

        {slices.map((s) => {
          const lifted = hover === s.i;
          const dx = lifted ? Math.cos(s.mid) * 12 : 0;
          const dy = lifted ? Math.sin(s.mid) * 12 : 0;
          const [lx, ly] = polar((R_OUT + R_IN) / 2, s.mid);
          return (
            <g
              key={s.name}
              style={{ transform: `translate(${dx}px, ${dy}px)`, transition: 'transform 180ms ease-out', cursor: 'default' }}
              filter={lifted ? `url(#${uid}-lift)` : undefined}
              onMouseEnter={() => setHover(s.i)}
              onMouseLeave={() => setHover(null)}
            >
              <path d={s.span >= Math.PI * 2 - 0.001 ? fullRing() : sector(s.a0, s.a1)} fill={s.color} fillRule="evenodd" />
              {s.pct >= 4 && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="14" fontWeight="500" pointerEvents="none">
                  {s.pct % 1 === 0 ? s.pct.toFixed(0) : s.pct.toFixed(2)}%
                </text>
              )}
            </g>
          );
        })}

        <circle cx={C} cy={C} r={R_IN - 1} fill={centerLabel ? '#fff' : '#f8fbff'} filter={`url(#${uid}-hole)`} pointerEvents="none" />
        {!centerLabel && (
          <circle cx={C} cy={C} r={R_IN - 10} fill="none" stroke="#2563eb" strokeOpacity="0.1" strokeWidth="1" pointerEvents="none" />
        )}
        <text x={C} y={centerLabel ? C - 8 : C} textAnchor="middle" dominantBaseline="central" fill={centerLabel ? '#1f2937' : '#1d4ed8'} fontSize={centerLabel ? 26 : 38} fontWeight={centerLabel ? 500 : 600} className="font-sans tabular-nums tracking-tight" pointerEvents="none">
          {showLeadPercentage && <title>{`${activeSlice.name}: ${activeSlice.value} of ${total} leads`}</title>}
          {displayedValue}
        </text>
        <text x={C} y={C + 20} textAnchor="middle" dominantBaseline="central" fill="#1f2937" fontSize="15" fontWeight="500" letterSpacing="0.5" pointerEvents="none">
          {centerLabel}
        </text>
      </svg>

      <ul className="flex flex-col gap-[14px]">
        {slices.map((s) => (
          <li
            key={s.name}
            className={cn('flex cursor-default items-center gap-3 text-[15px] text-[#7a7f8c] transition-colors', hover === s.i && 'text-[#1f2937]')}
            onMouseEnter={() => setHover(s.i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-[14px] w-[14px] shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
