import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

// A score on an arc, like the globe's horizon: the student drags a marker
// along it (or uses the arrow keys). On the target step the same arc also
// shows where they are today, the climb between the two, and the band of
// scores their dream university admits.

const W = 320;
const H = 186;
const CX = W / 2;
const CY = 168;
const R = 138;
const STEP = 10;

type Props = {
  /** What the marker sets, for screen readers ("Your score today"). */
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  /** The marker's colour: teal for today, gold for the goal. */
  tone?: 'today' | 'goal';
  /** A fixed marker for today's score (the target step); the arc between it and the value is the climb. */
  today?: number | null;
  /** The scores the dream university admits, drawn as a band. */
  band?: { from: number; to: number } | null;
  /** What sits inside the arc (the number and its caption). */
  children: ReactNode;
  className?: string;
};

const TEAL = '#7fe3d4';
const GOLD = '#f6c343';

export function ScoreArc({ label, min, max, value, onChange, tone = 'goal', today = null, band = null, children, className = '' }: Props) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / STEP) * STEP));
  const share = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  // The arc runs over the top, from the left foot (min) to the right foot (max).
  const point = (v: number, r = R) => {
    const a = Math.PI * (1 - share(v));
    return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
  };
  const arc = (from: number, to: number, r = R) => {
    const [a, b] = from <= to ? [from, to] : [to, from];
    const p = point(a, r);
    const q = point(b, r);
    return `M ${p.x} ${p.y} A ${r} ${r} 0 0 1 ${q.x} ${q.y}`;
  };

  function fromPointer(e: PointerEvent) {
    const el = svg.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W - CX;
    const y = CY - ((e.clientY - box.top) / box.height) * H;
    const a = Math.atan2(Math.max(y, 0), x); // 0 (right foot) … π (left foot)
    const v = clamp(min + (1 - a / Math.PI) * (max - min));
    if (v !== value) onChange(v);
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    // Only a press on or near the arc takes the marker (not one inside it).
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W - CX;
    const y = CY - ((e.clientY - box.top) / box.height) * H;
    if (Math.abs(Math.hypot(x, y) - R) > 46) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    fromPointer(e);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (dragging) fromPointer(e);
  }
  function key(e: KeyboardEvent) {
    const by: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 50, PageDown: -50 };
    const v = e.key === 'Home' ? min : e.key === 'End' ? max : e.key in by ? clamp(value + by[e.key]!) : null;
    if (v == null) return;
    e.preventDefault();
    if (v !== value) onChange(v);
  }

  const knob = point(value);
  const color = tone === 'today' ? TEAL : GOLD;
  const hundreds: number[] = [];
  for (let v = Math.ceil(min / 100) * 100; v <= max; v += 100) hundreds.push(v);

  return (
    <div className={`relative mx-auto w-full max-w-[340px] select-none ${className}`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className={`block w-full touch-none outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} focus-visible:[&_.knob]:stroke-white`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={key}>
        <defs>
          <linearGradient id={`${id}-climb`} gradientUnits="userSpaceOnUse" x1={point(today ?? min).x} y1="0" x2={knob.x} y2="0">
            <stop offset="0" stopColor={TEAL} />
            <stop offset="1" stopColor={GOLD} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Ticks every 100, outside the track. */}
        {hundreds.map((v) => {
          const a = point(v, R + 10);
          const b = point(v, R + (v % 200 === 0 ? 18 : 15));
          return <line key={v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(222,212,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />;
        })}

        <path d={arc(min, max)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
        {band && <path d={arc(band.from, band.to)} fill="none" stroke="rgba(246,195,67,0.55)" strokeWidth="16" strokeLinecap="butt" />}
        {today != null ? (
          <>
            <path d={arc(today, value)} fill="none" stroke={`url(#${id}-climb)`} strokeWidth="10" strokeLinecap="round" filter={`url(#${id}-glow)`} opacity="0.7" />
            <path d={arc(today, value)} fill="none" stroke={`url(#${id}-climb)`} strokeWidth="10" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d={arc(min, value)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" filter={`url(#${id}-glow)`} opacity="0.55" />
            <path d={arc(min, value)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          </>
        )}

        {today != null && <circle cx={point(today).x} cy={point(today).y} r="7" fill={TEAL} stroke="#07031a" strokeWidth="3" />}
        <circle cx={knob.x} cy={knob.y} r="17" fill={color} opacity="0.25" />
        <circle className="knob" cx={knob.x} cy={knob.y} r="11" fill={color} stroke="#07031a" strokeWidth="3" />

        <text x={point(min).x} y={H - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(222,212,255,0.5)">
          {min}
        </text>
        <text x={point(max).x} y={H - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(222,212,255,0.5)">
          {max}
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-[14px] flex flex-col items-center text-center">{children}</div>
    </div>
  );
}
