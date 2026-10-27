"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface Point {
  label: string;
  value: number;
  /** Extra line shown in the tooltip. */
  detail?: string;
}

interface ChartProps {
  data: Point[];
  /** Accessible summary of what the chart shows. */
  title: string;
  max?: number;
  formatValue?: (v: number) => string;
  height?: number;
  ticks?: number[];
}

const W = 640;
const PAD = { top: 16, right: 44, bottom: 30, left: 40 };

function Tooltip({ x, y, h, value, label, detail }: { x: number; y: number; h: number; value: string; label: string; detail?: string }) {
  const left = `${Math.min(88, Math.max(12, (x / W) * 100))}%`;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left, top: `calc(${(y / h) * 100}% - 10px)` }}
      role="presentation"
    >
      <p className="text-sm font-bold text-ink tabular-nums">{value}</p>
      <p className="text-muted">{label}</p>
      {detail && <p className="text-muted">{detail}</p>}
    </div>
  );
}

/** Single-series line chart: 2px line, 8px markers with surface ring, hairline grid, crosshair tooltip. */
export function LineChart({ data, title, max = 100, formatValue = (v) => `${v}%`, height = 220, ticks = [0, 25, 50, 75, 100] }: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.min(v, max) / max) * innerH;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = data.length > 1 ? `${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const last = data.length - 1;

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    return best;
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={title}
        onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-[var(--muted)] text-[11px]">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--line-strong)" strokeWidth={1} />}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={active === i ? 6 : 4.5}
              fill="var(--primary)"
              stroke="var(--surface)"
              strokeWidth={2}
              tabIndex={0}
              aria-label={`${d.label}: ${formatValue(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:stroke-[var(--ink)]"
            />
            {(i === 0 || i === last || data.length <= 6) && (
              <text x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                {d.label}
              </text>
            )}
          </g>
        ))}
        {data.length > 0 && (
          <text x={x(last) + 10} y={y(data[last].value)} dominantBaseline="middle" className="fill-[var(--ink)] text-[12px] font-semibold">
            {formatValue(data[last].value)}
          </text>
        )}
      </svg>
      {active !== null && data[active] && (
        <Tooltip x={x(active)} y={y(data[active].value)} h={height} value={formatValue(data[active].value)} label={data[active].label} detail={data[active].detail} />
      )}
    </div>
  );
}

/** Single-series column chart with per-column hover/focus tooltips. Columns are ≤24px with 4px rounded tops. */
export function ColumnChart({ data, title, max, formatValue = (v) => String(v), height = 200 }: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  const niceTop = Math.ceil(top / 5) * 5 || 5;
  const ticks = [0, niceTop / 2, niceTop];
  const innerW = W - PAD.left - 16;
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band - 2);
  const y = (v: number) => PAD.top + innerH - (v / niceTop) * innerH;
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label={title} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - 16} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-[var(--muted)] text-[11px]">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h / 2, barW / 2);
          const x0 = cx - barW / 2;
          const y0 = y(d.value);
          const shape = h > 0 ? `M${x0},${y(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${y(0)} Z` : "";
          return (
            <g key={i} onPointerEnter={() => setActive(i)}>
              <rect x={cx - band / 2} y={PAD.top} width={band} height={innerH} fill="transparent" />
              {shape && <path d={shape} fill="var(--primary)" opacity={active === null || active === i ? 1 : 0.55} />}
              <rect
                x={cx - band / 2}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${formatValue(d.value)}`}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-[var(--primary)]"
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active !== null && data[active] && (
        <Tooltip x={PAD.left + band * active + band / 2} y={y(data[active].value)} h={height} value={formatValue(data[active].value)} label={data[active].label} detail={data[active].detail} />
      )}
    </div>
  );
}

/** Horizontal bars with the value at the tip (≤24px thick, 4px rounded data-end). */
export function BarList({ rows, formatValue = (v) => `${v}%`, max = 100 }: { rows: (Point & { href?: string })[]; formatValue?: (v: number) => string; max?: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm" title={r.detail}>
          <span className="truncate font-semibold text-ink">{r.label}</span>
          <span className="h-4 rounded-r bg-surface-muted" aria-hidden>
            <span className={cn("block h-full rounded-r-[4px] bg-primary", r.value === 0 && "hidden")} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
          </span>
          <span className="text-right font-semibold text-ink tabular-nums">
            <span className="sr-only">{r.label}: </span>
            {formatValue(r.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
