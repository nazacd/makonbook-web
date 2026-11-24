import { LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { xp, type Gamification } from '@/api/gamification';
import { CATALOGUE, iconOf, type Entry } from '@/components/achievements/catalogue';
import { Badge, type FrameShape } from '@/components/achievements/Icons';
import { relativeDay } from '@/lib/schedule';

// The achievements as a tree, the old games' way: a pit of rock that scrolls
// and drags (the owner's picture, `public/achievements/pit.webp`, darker in
// the dark theme; blocks drawn in code if it is missing), each achievement
// in its frame over it, hanging from the one before, with elbowed arrows.
// Three states: earned (a grey frame, the arrow bright), next (its parent is
// earned: the purple frame glows, so the eye finds what to do), and further
// off (dimmed). One being worked on shows a small bar under its frame;
// secrets keep their sack shut. Hover or press a frame for a slab tooltip.

type Achievement = Gamification['achievements'][number];

const CELL = 80; // grid pitch
const NODE = 52; // a frame's size
const PAD = 64; // around the tree
const COLS = Math.max(...CATALOGUE.map((n) => n.col)) + 1;
const ROWS = Math.max(...CATALOGUE.map((n) => n.row)) + 1;
const W = PAD * 2 + (COLS - 1) * CELL + NODE;
const H = PAD * 2 + (ROWS - 1) * CELL + NODE;
const at = (n: Entry, dx = 0) => ({ x: dx + PAD + n.col * CELL + NODE / 2, y: PAD + n.row * CELL + NODE / 2 });

const HEAD: Record<FrameShape, string> = { advancement: 'Achievement', goal: 'Goal', challenge: 'Challenge' };

// ---- the fallback pit: dirt, stone, deepslate, ore, drawn once per size ----
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintPit(canvas: HTMLCanvasElement, width: number, height: number) {
  const px = 8; // one "pixel" of the world
  const cols = Math.ceil(width / px);
  const rows = Math.ceil(height / px);
  canvas.width = cols;
  canvas.height = rows;
  const g = canvas.getContext('2d')!;
  const r = rng(2026);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]!;
  const DIRT = ['#7a5538', '#6e4b31', '#86603f', '#654429'];
  const STONE = ['#7d7d7d', '#737373', '#858585', '#6c6c6c'];
  const DEEP = ['#4a4b50', '#43444a', '#515258', '#3b3c41'];
  const BED = ['#2a2a2f', '#232327', '#303035', '#1c1c20'];
  const mix = (a: string, b: string, t: number) => {
    const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * t)).join(',')})`;
  };
  for (let y = 0; y < rows; y++) {
    const depth = y / rows;
    for (let x = 0; x < cols; x++) {
      let c: string;
      if (depth < 0.08 || (depth < 0.16 && r() < (0.16 - depth) / 0.08)) c = pick(DIRT);
      else if (depth < 0.55) c = mix(pick(STONE), pick(DEEP), Math.max(0, (depth - 0.2) / 0.35));
      else c = mix(pick(DEEP), pick(BED), Math.min(1, (depth - 0.55) / 0.35));
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
  }
}

// ---- arrows: an elbow from the parent to the child, with a head at the child ----
function arrow(p: { x: number; y: number }, c: { x: number; y: number }) {
  const half = NODE / 2;
  if (p.y === c.y) {
    const dir = Math.sign(c.x - p.x);
    const end = c.x - dir * (half + 3);
    return { d: `M${p.x + dir * half} ${p.y}H${end}`, head: head(end, c.y, dir, 0) };
  }
  if (p.x === c.x) {
    const dir = Math.sign(c.y - p.y);
    const end = c.y - dir * (half + 3);
    return { d: `M${p.x} ${p.y + dir * half}V${end}`, head: head(c.x, end, 0, dir) };
  }
  // out of the parent sideways, then down or up, then into the child sideways
  const dx = Math.sign(c.x - p.x);
  const midX = (p.x + c.x) / 2;
  const end = c.x - dx * (half + 3);
  return { d: `M${p.x + dx * half} ${p.y}H${midX}V${c.y}H${end}`, head: head(end, c.y, dx, 0) };
}
function head(x: number, y: number, dx: number, dy: number) {
  const s = 7;
  if (dx) return `M${x} ${y - s / 1.4}L${x + dx * s} ${y}L${x} ${y + s / 1.4}Z`;
  return `M${x - s / 1.4} ${y}L${x} ${y + dy * s}L${x + s / 1.4} ${y}Z`;
}

export function AchievementTree({ g, now }: { g: Gamification; now: number }) {
  const byCode = new Map<string, Achievement>(g.achievements.map((a) => [a.code, a]));
  const nodes = CATALOGUE.filter((n) => byCode.has(n.code));
  const earned = (code?: string) => !code || !!byCode.get(code)?.unlocked_at;
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  // The pit is at least as wide as its box, the tree centred in it.
  const [width, setWidth] = useState(W);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(W, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dx = Math.floor((width - W) / 2);
  const pos = new Map(nodes.map((n) => [n.code, at(n, dx)]));

  // The pit's picture, covering it and repeated sideways; else the drawn rock.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let gone = false;
    const img = new Image();
    img.onload = () => {
      if (gone) return;
      el.width = width;
      el.height = H;
      const c = el.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      const w = Math.round(img.naturalWidth * (H / img.naturalHeight));
      for (let x = 0; x < width; x += w) c.drawImage(img, x, 0, w, H);
    };
    img.onerror = () => {
      if (!gone) paintPit(el, width, H);
    };
    img.src = '/achievements/pit.webp';
    return () => {
      gone = true;
    };
  }, [width]);

  const centre = (smooth: boolean) => {
    const el = scroller.current;
    const root = nodes[0];
    if (!el || !root) return;
    const p = at(root, dx);
    el.scrollTo({ left: Math.max(0, p.x - el.clientWidth / 2), top: Math.max(0, p.y - el.clientHeight / 2), behavior: smooth ? 'smooth' : 'auto' });
  };
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current) return;
    centred.current = true;
    centre(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the width is first known
  }, [dx]);

  // Drag to pan, as well as the scrollbars and the wheel.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType === 'touch' || !scroller.current) return;
    drag.current = { x: e.clientX, y: e.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !scroller.current) return;
    scroller.current.scrollLeft = d.left - (e.clientX - d.x);
    scroller.current.scrollTop = d.top - (e.clientY - d.y);
  };
  const onUp = () => {
    drag.current = null;
  };

  const tiers: FrameShape[] = ['advancement', 'goal', 'challenge'];
  const count = (tier: FrameShape) => {
    const list = g.achievements.filter((a) => a.tier === tier);
    return { done: list.filter((a) => a.unlocked_at).length, all: list.length };
  };

  return (
    <div className="mc-tree">
      <div ref={scroller} className="mc-pit" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={() => setOpen(null)}>
        <div className="mc-pit-inner" style={{ width, height: H }}>
          <canvas ref={canvas} className="mc-pit-canvas" aria-hidden="true" />
          <svg className="mc-pit-lines" width={width} height={H} aria-hidden="true">
            {nodes.map((n) => {
              if (!n.parent || !pos.has(n.parent)) return null;
              const { d, head: h } = arrow(pos.get(n.parent)!, pos.get(n.code)!);
              return (
                <g key={n.code} className={earned(n.code) ? 'is-on' : earned(n.parent) ? 'is-next' : ''}>
                  <path d={d} className="mc-line-shadow" />
                  <path d={d} className="mc-line" />
                  <path d={h} className="mc-line-head" />
                </g>
              );
            })}
          </svg>
          {nodes.map((n) => {
            const a = byCode.get(n.code)!;
            const p = pos.get(n.code)!;
            const on = !!a.unlocked_at;
            const hidden = a.secret && !on;
            const next = !on && earned(n.parent);
            const isOpen = open === n.code;
            const part = !on && !hidden && a.target > 1 && a.progress > 0 ? Math.min(1, a.progress / a.target) : 0;
            return (
              <div key={n.code} className={`mc-node ${on ? 'is-on' : next ? 'is-next' : 'is-far'} ${isOpen ? 'is-open' : ''}`} style={{ left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE, height: NODE }}>
                <button
                  type="button"
                  className="mc-node-btn"
                  aria-label={`${a.title}. ${a.description} ${on ? 'Earned.' : hidden ? '' : `${a.progress} of ${a.target}.`}`}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(isOpen ? null : n.code);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}>
                  <Badge icon={iconOf(a.code, hidden)} shape={a.tier} done={on} size={NODE} dim={!on && !next} />
                </button>
                {part > 0 && (
                  <span className="mc-node-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(8, part * 100)}%` }} />
                  </span>
                )}
                <div className={`mc-tip ${p.y < 170 ? 'is-below' : ''} ${p.x < 190 ? 'is-left' : p.x > width - 190 ? 'is-right' : ''}`} data-kind={a.tier} role="tooltip">
                  <span className="mc-tip-head">{on ? (a.tier === 'challenge' ? 'Challenge complete!' : 'Achievement unlocked!') : HEAD[a.tier]}</span>
                  <span className="mc-tip-title">{a.title}</span>
                  <span className="mc-tip-sub">
                    {a.description} {on ? `Earned ${relativeDay(Date.parse(a.unlocked_at!), now)}.` : hidden ? '' : `${xp(a.progress)} / ${xp(a.target)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" className="mc-pit-centre" onClick={() => centre(true)} aria-label="Back to the start of the tree" title="Back to the start">
        <LocateFixed size={16} aria-hidden="true" />
      </button>
      <div className="mc-legend">
        {tiers.map((t) => {
          const c = count(t);
          return (
            <span key={t} className="mc-legend-item">
              <img src={`/achievements/frame-${t}-done.png`} alt="" width={18} height={18} />
              {HEAD[t]}s{' '}
              <b>
                {c.done}/{c.all}
              </b>
            </span>
          );
        })}
        <span className="mc-legend-item mc-legend-hint">Grey is earned, purple is to do, a glow is what’s next. Drag to look around.</span>
      </div>
    </div>
  );
}
