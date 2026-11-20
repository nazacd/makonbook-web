import { useEffect, useRef, useState } from 'react';

import { xp, type Gamification } from '@/api/gamification';
import { Badge, ICON_OF, type FrameShape } from '@/components/achievements/PixelIcon';
import { relativeDay } from '@/lib/schedule';

// The achievements window, the old games' way: a scrolling pit of blocks,
// dirt at the top and stone darkening to the bottom with ore in it, drawn
// in code; the achievements laid out as a tree over it, each in its frame,
// arrows from each to the ones it leads to; a slab tooltip on hover or
// press. Earned ones are bright; the rest sit in their purple frames,
// dimmed; secrets show a padlock and "???".

type Node = { code: string; col: number; row: number; parent?: string };

/** Where each achievement sits (grid cells) and what it hangs from. */
const LAYOUT: Node[] = [
  { code: 'first_xp', col: 3, row: 5 },
  // XP and levels, straight up
  { code: 'xp_500', col: 3, row: 4, parent: 'first_xp' },
  { code: 'xp_1000', col: 3, row: 3, parent: 'xp_500' },
  { code: 'level_5', col: 3, row: 2, parent: 'xp_1000' },
  { code: 'level_10', col: 3, row: 1, parent: 'level_5' },
  // quests, up and left
  { code: 'quests_5', col: 2, row: 4, parent: 'xp_500' },
  { code: 'quests_25', col: 1, row: 4, parent: 'quests_5' },
  { code: 'full_house', col: 2, row: 3, parent: 'quests_5' },
  { code: 'clean_sweep', col: 1, row: 3, parent: 'full_house' },
  // the clock, up and right
  { code: 'night_owl', col: 4, row: 3, parent: 'xp_1000' },
  { code: 'early_bird', col: 5, row: 3, parent: 'night_owl' },
  // the streak, to the left
  { code: 'streak_3', col: 2, row: 5, parent: 'first_xp' },
  { code: 'streak_7', col: 1, row: 5, parent: 'streak_3' },
  { code: 'streak_30', col: 0, row: 5, parent: 'streak_7' },
  { code: 'streak_100', col: 0, row: 4, parent: 'streak_30' },
  { code: 'weekend_scholar', col: 1, row: 6, parent: 'streak_7' },
  { code: 'comeback', col: 0, row: 6, parent: 'streak_30' },
  // answers, to the right
  { code: 'answers_100', col: 4, row: 5, parent: 'first_xp' },
  { code: 'answers_500', col: 5, row: 5, parent: 'answers_100' },
  { code: 'answers_2000', col: 6, row: 5, parent: 'answers_500' },
  { code: 'answers_10000', col: 7, row: 5, parent: 'answers_2000' },
  // tests and scores, right and up
  { code: 'pencil_age', col: 5, row: 4, parent: 'answers_100' },
  { code: 'tests_10', col: 6, row: 4, parent: 'pencil_age' },
  { code: 'on_target', col: 7, row: 4, parent: 'tests_10' },
  { code: 'club_1500', col: 7, row: 3, parent: 'on_target' },
  { code: 'full_marks', col: 7, row: 2, parent: 'club_1500' },
  { code: 'perfect_set', col: 6, row: 3, parent: 'tests_10' },
  // words and reading, down
  { code: 'getting_words', col: 3, row: 6, parent: 'first_xp' },
  { code: 'reviews_500', col: 3, row: 7, parent: 'getting_words' },
  { code: 'reviews_2000', col: 3, row: 8, parent: 'reviews_500' },
  { code: 'open_book', col: 4, row: 6, parent: 'getting_words' },
  { code: 'bookworm', col: 5, row: 6, parent: 'open_book' },
  // school life, down and left
  { code: 'dream_set', col: 2, row: 6, parent: 'first_xp' },
  { code: 'front_row', col: 2, row: 7, parent: 'dream_set' },
  { code: 'regular', col: 1, row: 7, parent: 'front_row' },
  { code: 'contender', col: 2, row: 8, parent: 'front_row' },
  { code: 'podium', col: 1, row: 8, parent: 'contender' },
  { code: 'graduation', col: 0, row: 7, parent: 'regular' },
  // the sharpshooters
  { code: 'sniper', col: 6, row: 6, parent: 'answers_2000' },
  { code: 'pair_of_aces', col: 4, row: 7, parent: 'getting_words' },
];

const CELL = 76; // grid pitch
const NODE = 52; // a frame's size
const PAD = 60; // around the tree
const COLS = Math.max(...LAYOUT.map((n) => n.col)) + 1;
const ROWS = Math.max(...LAYOUT.map((n) => n.row)) + 1;
const W = PAD * 2 + (COLS - 1) * CELL + NODE;
const H = PAD * 2 + (ROWS - 1) * CELL + NODE;
const at = (n: Node, dx = 0) => ({ x: dx + PAD + n.col * CELL + NODE / 2, y: PAD + n.row * CELL + NODE / 2 });

const SHAPE: Record<string, FrameShape> = { advancement: 'advancement', goal: 'goal', challenge: 'challenge' };
const HEAD: Record<string, string> = { advancement: 'Achievement', goal: 'Goal', challenge: 'Challenge' };

// ---- the pit: dirt, stone, deepslate, ore, drawn once per size ----
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
  // ore and the odd dirt pocket, in little clusters, each kind at its depth
  const ORE: [string, number, number][] = [
    ['#1f1f1f', 0.1, 0.5], // coal
    ['#c9a27e', 0.15, 0.7], // iron
    ['#e6c34a', 0.3, 0.8], // gold
    ['#c22d2d', 0.45, 0.95], // redstone
    ['#2d4fb8', 0.4, 0.8], // lapis
    ['#5fd9e6', 0.7, 1], // diamond
  ];
  for (let i = 0; i < cols * rows * 0.012; i++) {
    const x = Math.floor(r() * cols);
    const y = Math.floor(r() * rows);
    const depth = y / rows;
    const kinds = ORE.filter(([, lo, hi]) => depth >= lo && depth <= hi);
    const kind = depth < 0.3 && r() < 0.25 ? pick(DIRT) : kinds.length ? pick(kinds)[0] : null;
    if (!kind) continue;
    const n = 2 + Math.floor(r() * 3);
    g.fillStyle = kind;
    for (let k = 0; k < n; k++) g.fillRect(Math.min(cols - 1, x + Math.floor(r() * 2)), Math.min(rows - 1, y + Math.floor(r() * 2)), 1, 1);
  }
}

// ---- arrows: an elbow from the parent to the child, with a head at the child ----
function arrow(p: { x: number; y: number }, c: { x: number; y: number }) {
  const half = NODE / 2;
  if (p.y === c.y) {
    const dir = Math.sign(c.x - p.x);
    const end = c.x - dir * (half + 2);
    return { d: `M${p.x + dir * half} ${p.y}H${end}`, head: head(end, c.y, dir, 0) };
  }
  if (p.x === c.x) {
    const dir = Math.sign(c.y - p.y);
    const end = c.y - dir * (half + 2);
    return { d: `M${p.x} ${p.y + dir * half}V${end}`, head: head(c.x, end, 0, dir) };
  }
  // out of the parent sideways, then down or up, then into the child sideways
  const dx = Math.sign(c.x - p.x);
  const dy = Math.sign(c.y - p.y);
  const midX = (p.x + c.x) / 2;
  const end = c.x - dx * (half + 2);
  return { d: `M${p.x + dx * half} ${p.y}H${midX}V${c.y}H${end}`, head: head(end, c.y, dx, 0 * dy) };
}
function head(x: number, y: number, dx: number, dy: number) {
  const s = 7;
  if (dx) return `M${x} ${y - s / 1.4}L${x + dx * s} ${y}L${x} ${y + s / 1.4}Z`;
  return `M${x - s / 1.4} ${y}L${x} ${y + dy * s}L${x + s / 1.4} ${y}Z`;
}

export function AchievementTree({ g, now }: { g: Gamification; now: number }) {
  const byCode = new Map(g.achievements.map((a) => [a.code, a]));
  const nodes = LAYOUT.filter((n) => byCode.has(n.code));
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  // The pit is at least as wide as the window, the tree centred in it.
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

  // The pit's picture: public/achievements/pit.webp when it is there (the
  // owner's own, generated to brief), covering the pit, repeated sideways on
  // very wide windows; otherwise the blocks drawn in code.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let gone = false;
    const img = new Image();
    img.onload = () => {
      if (gone) return;
      el.width = width;
      el.height = H;
      const g = el.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      const scale = H / img.naturalHeight;
      const w = Math.round(img.naturalWidth * scale);
      for (let x = 0; x < width; x += w) g.drawImage(img, x, 0, w, H);
    };
    img.onerror = () => {
      if (!gone) paintPit(el, width, H);
    };
    img.src = '/achievements/pit.webp';
    return () => {
      gone = true;
    };
  }, [width]);
  const centred = useRef(false);
  useEffect(() => {
    // Start with the root in view, once the width is known.
    const el = scroller.current;
    if (!el || centred.current) return;
    centred.current = true;
    const root = at(LAYOUT[0]!, dx);
    el.scrollTo({ left: Math.max(0, root.x - el.clientWidth / 2), top: Math.max(0, root.y - el.clientHeight / 2) });
  }, [dx]);

  // Drag to pan, as well as the scrollbars and the wheel.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !scroller.current) return;
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

  const earned = g.achievements.filter((a) => a.unlocked_at).length;
  return (
    <div className="mc-window">
      <div className="mc-window-title">
        <span>Achievements</span>
        <span className="mc-window-count">
          {earned} / {g.achievements.length}
        </span>
      </div>
      <div ref={scroller} className="mc-pit" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
        <div className="mc-pit-inner" style={{ width, height: H }}>
          <canvas ref={canvas} className="mc-pit-canvas" aria-hidden="true" />
          <svg className="mc-pit-lines" width={width} height={H} aria-hidden="true">
            {nodes.map((n) => {
              if (!n.parent || !pos.has(n.parent)) return null;
              const { d, head: h } = arrow(pos.get(n.parent)!, pos.get(n.code)!);
              const on = !!byCode.get(n.code)?.unlocked_at;
              return (
                <g key={n.code} className={on ? 'is-on' : ''}>
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
            const isOpen = open === n.code;
            return (
              <div key={n.code} className={`mc-node ${isOpen ? 'is-open' : ''}`} style={{ left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE, height: NODE }}>
                <button
                  type="button"
                  className="mc-node-btn"
                  aria-label={`${a.title}. ${a.description} ${on ? 'Unlocked.' : `${a.progress} of ${a.target}.`}`}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(isOpen ? null : n.code);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}>
                  <Badge icon={hidden ? 'lock' : (ICON_OF[a.code] ?? 'star')} shape={SHAPE[a.tier] ?? 'advancement'} done={on} size={NODE} dim={!on} />
                </button>
                <div className={`mc-tip ${p.y < 160 ? 'is-below' : ''} ${p.x < 180 ? 'is-left' : p.x > width - 180 ? 'is-right' : ''}`} data-kind={a.tier} role="tooltip">
                  <span className="mc-tip-head">{on ? (a.tier === 'challenge' ? 'Challenge complete!' : 'Achievement unlocked!') : HEAD[a.tier]}</span>
                  <span className="mc-tip-title">{a.title}</span>
                  <span className="mc-tip-sub">
                    {a.description} {on ? `Unlocked ${relativeDay(Date.parse(a.unlocked_at!), now)}.` : hidden ? '' : `${xp(a.progress)} / ${xp(a.target)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mc-window-foot">Drag or scroll to look around. Hover or press a frame for what it takes.</p>
    </div>
  );
}
