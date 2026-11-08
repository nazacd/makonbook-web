import type { Roadmap, RoadmapUnit } from '@/api/roadmaps';

// The journey map's layout, bottom to top: the start (ground), then each
// country's stops zig-zagging up, a border wall into the next country, and
// the goal at the very top. Everything is in px from the top of the canvas,
// for a canvas `width` wide.

export const STOP_GAP = 190; // between two stops
export const GROUND = 150; // the start, at the bottom
export const WALL = 170; // a border into the next country
export const GOAL = 230; // the goal, at the top

/** Each country's own night colour. */
export const REGION_COLORS = ['#132a4a', '#24205c', '#3b1838', '#0f3b3d', '#2e2a12', '#1f3420'];

export type Stop = { unit: RoadmapUnit; index: number; country: number; x: number; y: number };
export type Region = { country: number; name: string; code: string | null; top: number; bottom: number; locked: boolean };

/** Short letters for a university's medallion: its own short name if it has one, else initials. */
export function initials(name: string): string {
  const inBrackets = name.match(/\(([A-Z]{2,6})\)/);
  if (inBrackets) return inBrackets[1]!;
  const first = name.split(/[\s(]/)[0]!;
  if (/^[A-Z]{2,6}$/.test(first)) return first; // KAIST, ETH, EPFL
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s,-]+/)
    .filter((w) => w && !/^(of|the|and|in|for|de|at)$/i.test(w));
  return words
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 4);
}

export function layout(r: Roadmap, width: number) {
  const units = new Map(r.units.map((u) => [u.id, u]));
  const order = r.countries.flatMap((c, ci) => c.units.map((id) => ({ unit: units.get(id)!, country: ci }))).filter((x) => x.unit);
  // x zig-zags: centre, right, centre, left… narrower on a phone, so the labels fit.
  const swing = width < 600 ? 0.2 : Math.min(0.24, (width / 2 - 140) / width);
  const xAt = (i: number) => width * (0.5 + swing * [0, 1, 0, -1][i % 4]!);

  // Heights: ground, then per country (its stops, plus a wall below every country but the first), then the goal.
  const regionHeights = r.countries.map((c, ci) => c.units.length * STOP_GAP + (ci > 0 ? WALL : 0) + (ci === 0 ? 40 : 0));
  const height = GROUND + regionHeights.reduce((a, b) => a + b, 0) + GOAL;

  const regions: Region[] = [];
  const stops: Stop[] = [];
  let bottom = height - GROUND; // y of the current region's bottom edge
  let i = 0;
  r.countries.forEach((c, ci) => {
    const top = bottom - regionHeights[ci]!;
    const firstUnit = units.get(c.units[0]!);
    regions.push({ country: ci, name: c.name, code: c.code, top, bottom, locked: firstUnit?.lock === 'enrolled_only' });
    let y = bottom - (ci > 0 ? WALL : 40) - STOP_GAP / 2;
    for (let k = 0; k < c.units.length; k++) {
      const o = order[i]!;
      stops.push({ unit: o.unit, index: i, country: ci, x: xAt(i), y });
      y -= STOP_GAP;
      i++;
    }
    bottom = top;
  });
  return { height, regions, stops };
}

/** The path between two stops: a gentle S. */
export function segment(a: { x: number; y: number }, b: { x: number; y: number }) {
  const my = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
}

/** Between two stops: into the next country it goes through the border's gate, straight up the middle. */
export function pathBetween(a: Stop, b: Stop, regions: Region[], width: number) {
  if (a.country === b.country) return segment(a, b);
  const wallBottom = regions[b.country]!.bottom;
  const below = { x: width / 2, y: wallBottom + 18 };
  const above = { x: width / 2, y: wallBottom - WALL + 10 };
  return `${segment(a, below)} L ${above.x} ${above.y} ${segment(above, b).replace(/^M [^C]+/, '')}`;
}

/** A stop's logo link, when the API sends one (null otherwise). */
export function logoOf(stop: object): string | null {
  const v = (stop as { logo_url?: unknown }).logo_url;
  return typeof v === 'string' ? v : null;
}
