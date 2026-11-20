import type { BurstOrigin, Holiday, Season } from '@/lib/season';

// The season's particles (from the old MakonBook's season-v70.js): spring's
// peach petals and blossoms, autumn's tumbling chinar leaves, winter's snow,
// crystals and girih stars, summer's pollen by day and fireflies by night
// (those rise). A holiday swaps the mix: snow and gold at New Year, tulips
// at Navruz and on 8 March, flag colours on Independence and Constitution
// Day, lanterns' glow and crescents at the Hayits, leaves and gold stars on
// Teachers' Day. Sprites are drawn once to small canvases; frames only
// drawImage. Moving the pointer makes wind. The layer decides when to run.

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
type Drawer = (g: CanvasRenderingContext2D, r: number) => void;
type Item = [weight: number, size: number, draw: Drawer];
type Recipe = { kind: 'fall' | 'float'; flip: boolean; speed: [number, number]; items: Item[] };

function sprite(size: number, draw: Drawer, blur: number) {
  const c = document.createElement('canvas');
  const pad = blur ? Math.ceil(blur * 3) : 2;
  c.width = c.height = size + pad * 2;
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2);
  if (blur && 'filter' in g) g.filter = `blur(${blur}px)`;
  draw(g, size / 2);
  return c;
}

const CHINAR = 'M50 94L48 75C40 79 28 81 17 78L24 68C13 64 5 56 3 47L16 47C11 39 11 29 15 20C24 27 30 31 34 34L31 17C38 21 43 13 50 3C57 13 62 21 69 17L66 34C70 31 76 27 85 20C89 29 89 39 84 47L97 47C95 56 87 64 76 68L83 78C72 81 60 79 52 75L50 94Z';
const CHINAR_VEINS = 'M50 90L50 12M50 62L18 26M50 62L82 26M50 66L10 49M50 66L90 49';

const draw = {
  petal(color: string): Drawer {
    return (g, r) => {
      const grad = g.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, '#ffe3ec');
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, r);
      g.bezierCurveTo(r * 0.95, r * 0.45, r * 0.85, -r * 0.7, r * 0.18, -r * 0.92);
      g.lineTo(0, -r * 0.62); // the little notch of a peach petal
      g.lineTo(-r * 0.18, -r * 0.92);
      g.bezierCurveTo(-r * 0.85, -r * 0.7, -r * 0.95, r * 0.45, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(194, 37, 92, .25)';
      g.lineWidth = Math.max(1, r * 0.06);
      g.beginPath();
      g.moveTo(0, r * 0.8);
      g.lineTo(0, -r * 0.35);
      g.stroke();
    };
  },
  blossom(): Drawer {
    return (g, r) => {
      for (let i = 0; i < 5; i++) {
        g.save();
        g.rotate((i * TAU) / 5);
        g.fillStyle = '#fbb6ce';
        g.beginPath();
        g.ellipse(0, -r * 0.5, r * 0.36, r * 0.5, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#c2255c';
      g.beginPath();
      g.arc(0, 0, r * 0.2, 0, TAU);
      g.fill();
      g.fillStyle = '#ffd43b';
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        g.beginPath();
        g.arc(Math.sin(a) * r * 0.3, -Math.cos(a) * r * 0.3, r * 0.07, 0, TAU);
        g.fill();
      }
    };
  },
  tulip(color: string): Drawer {
    return (g, r) => {
      g.scale(r / 14, r / 14);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 12);
      g.bezierCurveTo(-11, 10, -13, -4, -8, -14);
      g.lineTo(-4, -6);
      g.lineTo(0, -16);
      g.lineTo(4, -6);
      g.lineTo(8, -14);
      g.bezierCurveTo(13, -4, 11, 10, 0, 12);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath();
      g.moveTo(0, 12);
      g.bezierCurveTo(-5, 8, -5, -4, 0, -13);
      g.bezierCurveTo(5, -4, 5, 8, 0, 12);
      g.fill();
    };
  },
  chinar(color: string): Drawer {
    const leaf = new Path2D(CHINAR);
    const veins = new Path2D(CHINAR_VEINS);
    return (g, r) => {
      g.scale(r / 46, r / 46);
      g.translate(-50, -50);
      g.fillStyle = color;
      g.fill(leaf);
      g.strokeStyle = 'rgba(90, 40, 10, .32)';
      g.lineWidth = 2.2;
      g.stroke(veins);
    };
  },
  snow(dark: boolean): Drawer {
    // white on dark; a cool blue-grey on light backgrounds so it stays visible
    const [core, mid] = dark ? ['rgba(255,255,255,1)', 'rgba(255,255,255,.85)'] : ['rgba(150,190,228,1)', 'rgba(176,208,238,.85)'];
    return (g, r) => {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, core);
      grad.addColorStop(0.55, mid);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
    };
  },
  crystal(color: string): Drawer {
    return (g, r) => {
      g.strokeStyle = color;
      g.lineCap = 'round';
      g.lineWidth = Math.max(1.2, r * 0.12);
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((i * TAU) / 6);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -r);
        g.moveTo(0, -r * 0.55);
        g.lineTo(r * 0.28, -r * 0.78);
        g.moveTo(0, -r * 0.55);
        g.lineTo(-r * 0.28, -r * 0.78);
        g.stroke();
        g.restore();
      }
    };
  },
  girih(color: string): Drawer {
    return (g, r) => {
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i * TAU) / 16;
        const rr = i % 2 ? r * 0.52 : r;
        g.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr);
      }
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath();
      g.arc(0, 0, r * 0.22, 0, TAU);
      g.fill();
    };
  },
  star(color: string): Drawer {
    return (g, r) => {
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        const rr = i % 2 ? r * 0.38 : r;
        g.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr);
      }
      g.closePath();
      g.fill();
    };
  },
  crescent(color: string): Drawer {
    return (g, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.arc(r * 0.42, -r * 0.18, r * 0.82, 0, TAU, true);
      g.fill();
    };
  },
  square(color: string): Drawer {
    return (g, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(-r, -r, r * 2, r * 2, r * 0.25);
      g.fill();
    };
  },
  glow(core: string, halo: string): Drawer {
    return (g, r) => {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, core);
      grad.addColorStop(0.25, core);
      grad.addColorStop(1, halo);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
    };
  },
};

const PETALS = ['#f78fb3', '#f06595', '#ff8fab', '#fbb6ce', '#e64980'];
const LEAVES = ['#e76f51', '#f4a261', '#e9c46a', '#bc4749', '#d68c45'];

export function recipe(season: Season, holiday: Holiday | null, dark: boolean): Recipe {
  const gold = dark ? '#ffd166' : '#f4b728';
  const fall = (items: Item[], speed: [number, number] = [0.4, 1], flip = true): Recipe => ({ kind: 'fall', flip, speed, items });
  switch (holiday?.key) {
    case 'new-year':
      return fall([[52, 10, draw.snow(dark)], [20, 20, draw.crystal(dark ? 'rgba(220,238,255,.95)' : 'rgba(120,180,230,.9)')], [28, 16, draw.girih(gold)]], [0.3, 0.85], false);
    case 'navruz':
      return fall([...PETALS.map((c): Item => [12, 18, draw.petal(c)]), [12, 22, draw.blossom()], [16, 20, draw.tulip('#e5383b')], [12, 20, draw.tulip('#f4a261')]], [0.35, 0.9]);
    case 'womens-day':
      return fall([...PETALS.map((c): Item => [14, 18, draw.petal(c)]), [18, 20, draw.tulip('#e5383b')], [12, 20, draw.tulip('#f472b6')]], [0.35, 0.9]);
    case 'independence':
    case 'constitution':
      return fall([[34, 9, draw.square('#1eb0e6')], [33, 9, draw.square(dark ? '#f1f5f9' : '#cbd5e1')], [33, 9, draw.square('#2fb457')]], [0.45, 1.05]);
    case 'teachers-day':
      return fall([...LEAVES.map((c): Item => [16, 26, draw.chinar(c)]), [20, 14, draw.star(gold)]], [0.5, 1.1]);
    case 'ramazon-hayit':
    case 'qurbon-hayit':
      return { kind: 'float', flip: false, speed: [0.12, 0.35], items: [[70, 14, draw.glow('rgba(255,214,102,1)', 'rgba(255,190,60,0)')], [30, 16, draw.crescent(gold)]] };
  }
  if (season === 'spring') return fall([...PETALS.map((c): Item => [17, 18, draw.petal(c)]), [10, 22, draw.blossom()]], [0.35, 0.9]);
  if (season === 'autumn') return fall(LEAVES.map((c): Item => [20, 26, draw.chinar(c)]), [0.5, 1.1]);
  if (season === 'winter') {
    const ice = dark ? '#cfe8ff' : '#9ed2f5';
    return fall([[64, 10, draw.snow(dark)], [26, 20, draw.crystal(dark ? 'rgba(220,238,255,.95)' : 'rgba(120,180,230,.9)')], [10, 16, draw.girih(ice)]], [0.3, 0.85], false);
  }
  // summer: pollen by day, fireflies by night
  return dark
    ? { kind: 'float', flip: false, speed: [0.12, 0.35], items: [[100, 14, draw.glow('rgba(226,255,140,1)', 'rgba(190,255,90,0)')]] }
    : { kind: 'float', flip: false, speed: [0.12, 0.3], items: [[100, 12, draw.glow('rgba(255,214,102,1)', 'rgba(255,190,60,0)')]] };
}

type Spec = Recipe & { list: { w: number; size: number; img: HTMLCanvasElement }[] };
function buildSprites(r: Recipe, blur: number): Spec {
  const total = r.items.reduce((s, it) => s + it[0], 0);
  return { ...r, list: r.items.map(([w, size, fn]) => ({ w: w / total, size, img: sprite(size, fn, blur) })) };
}
function choose<T extends { w: number }>(list: T[]): T {
  let x = Math.random();
  for (const it of list) {
    x -= it.w;
    if (x <= 0) return it;
  }
  return list[list.length - 1]!;
}

type Part = { it: Spec['list'][number]; z: number; x: number; y: number; vy: number; vx: number; rot: number; vr: number; flip: number; vf: number; sway: number; phase: number; scale: number; tw: number; burst?: boolean };
type FieldOpts = { depth: [number, number]; scale: number; alpha: number; blur: number; count: (w: number, h: number) => number };
type Pointer = { x: number; y: number; active: boolean };

class Field {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private parts: Part[] = [];
  private spec: Spec | null = null;
  constructor(
    readonly canvas: HTMLCanvasElement,
    private opts: FieldOpts,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }
  rebuild(r: Recipe) {
    this.spec = buildSprites(r, this.opts.blur);
    this.parts = [];
    this.resize();
  }
  resize() {
    if (!this.spec) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = this.opts.count(this.W, this.H);
    while (this.parts.length < target) this.parts.push(this.spawn(true));
    this.parts.length = Math.min(this.parts.length, target);
  }
  private spawn(anywhere: boolean): Part {
    const spec = this.spec!;
    const it = choose(spec.list);
    const z = rand(this.opts.depth[0], this.opts.depth[1]);
    const floats = spec.kind === 'float';
    return {
      it,
      z,
      x: rand(-40, this.W + 40),
      y: anywhere ? rand(-this.H * 0.1, this.H) : floats ? this.H + 30 : -30,
      vy: rand(spec.speed[0], spec.speed[1]) * z * (floats ? -1 : 1),
      vx: rand(-0.15, 0.15),
      rot: rand(0, TAU),
      vr: rand(-0.02, 0.02),
      flip: rand(0, TAU),
      vf: rand(0.02, 0.05),
      sway: rand(0.6, 1.6),
      phase: rand(0, TAU),
      scale: this.opts.scale * z * rand(0.75, 1.15),
      tw: rand(0, TAU),
    };
  }
  step(dt: number, wind: number, pointer: Pointer) {
    const { ctx, parts, W, H } = this;
    const spec = this.spec;
    if (!spec) return;
    ctx.clearRect(0, 0, W, H);
    const floats = spec.kind === 'float';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      p.phase += 0.012 * dt;
      p.x += (p.vx + Math.sin(p.phase) * 0.35 * p.sway + wind * p.z) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (pointer.active) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 9000) {
          const f = (1 - d2 / 9000) * 1.6;
          p.x += (dx / 95) * f * dt;
          p.y += (dy / 95) * f * dt * 0.5;
        }
      }
      if ((!floats && p.y > H + 40) || (floats && p.y < -40) || p.x < -80 || p.x > W + 80) {
        if (p.burst) {
          parts.splice(i, 1);
          i--;
          continue;
        }
        parts[i] = this.spawn(false);
        continue;
      }
      const img = p.it.img;
      const s = p.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (spec.flip) ctx.scale(Math.cos(p.flip) * 0.85 + (Math.cos(p.flip) >= 0 ? 0.15 : -0.15), 1);
      if (floats) {
        p.tw += 0.03 * dt;
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(p.tw));
      } else ctx.globalAlpha = this.opts.alpha;
      ctx.drawImage(img, (-img.width / 2) * s, (-img.height / 2) * s, img.width * s, img.height * s);
      ctx.restore();
    }
  }
  burst(n: number, origin?: BurstOrigin) {
    if (!this.spec) return;
    for (let k = 0; k < n; k++) {
      const p = this.spawn(false);
      p.burst = true;
      if (origin) {
        p.x = origin.x + rand(-30, 30);
        p.y = origin.y + rand(-20, 20);
        p.vy = rand(-1.6, -0.4);
        p.vx = rand(-1.4, 1.4);
      } else p.y = rand(-60, 0);
      this.parts.push(p);
    }
  }
  clear() {
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.parts = [];
    this.spec = null;
  }
}

export type ParticlesOptions = { back: HTMLCanvasElement; front: HTMLCanvasElement | null; /** The dashboard: a fuller field. */ dense: boolean };

/** The two canvases (behind the cards and, on wide screens, a sparse blurred one in front) and their loop. */
export class Particles {
  private fields: Field[] = [];
  private running = false;
  private raf = 0;
  private last = 0;
  private wind = 0;
  private windTarget = 0;
  private pointer: Pointer & { lastX: number | null } = { x: 0, y: 0, active: false, lastX: null };
  private current: Recipe | null = null;
  private resizeTimer = 0;

  constructor({ back, front, dense }: ParticlesOptions) {
    const density = dense ? 1 : 0.45;
    this.fields.push(
      new Field(back, {
        depth: [0.55, 1],
        scale: 1,
        alpha: 0.92,
        blur: 0,
        count: (w, h) => Math.round(Math.min(46, Math.max(12, (w * h) / 26000)) * density * (this.current?.kind === 'float' ? 0.6 : 1)),
      }),
    );
    if (front) {
      this.fields.push(
        new Field(front, {
          depth: [1.1, 1.5],
          scale: 1.45,
          alpha: 0.6,
          blur: 1.4,
          // A few, so they read as depth and never sit on a line of text for long.
          count: (w) => (w >= 1100 && dense ? (this.current?.kind === 'float' ? 3 : 4) : 0),
        }),
      );
    }
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('resize', this.onResize);
  }

  private onPointer = (e: PointerEvent) => {
    const p = this.pointer;
    p.x = e.clientX;
    p.y = e.clientY;
    p.active = true;
    if (p.lastX !== null) this.windTarget = Math.max(-2.4, Math.min(2.4, this.windTarget + (e.clientX - p.lastX) * 0.012));
    p.lastX = e.clientX;
  };
  private onLeave = () => {
    this.pointer.active = false;
    this.pointer.lastX = null;
  };
  private onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.fields.forEach((f) => f.resize()), 150);
  };

  /** Draw this mix (the season's, the holiday's, light or dark). */
  setRecipe(r: Recipe) {
    this.current = r;
    this.fields.forEach((f) => f.rebuild(r));
  }

  setRunning(on: boolean) {
    if (on && !this.running) {
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    } else if (!on && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  private frame = (t: number) => {
    if (!this.running) return;
    const dt = Math.min(3, (t - this.last) / 16.67 || 1);
    this.last = t;
    this.windTarget *= 0.96;
    this.wind += (this.windTarget - this.wind) * 0.05;
    for (const f of this.fields) f.step(dt, this.wind, this.pointer);
    this.raf = requestAnimationFrame(this.frame);
  };

  burst(count: number, origin?: BurstOrigin) {
    if (this.running) this.fields[0]!.burst(count, origin);
  }

  destroy() {
    this.setRunning(false);
    clearTimeout(this.resizeTimer);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('resize', this.onResize);
    this.fields.forEach((f) => f.clear());
  }
}
