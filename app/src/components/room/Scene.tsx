import type { Season } from '@/lib/season';

import { GLOW, ROOM_ITEMS, THUMB, THUMB_OF, WALLPAPER, WINDOW_VIEW, type RoomSlot } from './items';

// Mako's room, drawn (spec 28): a wall with its paper, a window onto the
// season, the wall art, three shelves for the achievements earned, the
// floor with a rug, a light, a plant and the furniture. In the dark theme
// it is night: a veil over the room, the sky dark in the window, and the
// lamps that are placed glow (--room-night in styles.css). The furnished
// part is a 960 × 600 stage; with `pad` the wall and the floor carry on past
// it, so the room can fill a box of any shape. The drawings are in
// items.tsx; RoomDefs must be on the page.

export type Trophy = { code: string; title: string; icon: string };

/** How many trophies the three shelves hold. */
export const SHELF_ROOM = 30;
const SHELVES = [78, 168, 258];
const PER_SHELF = 10;

/** Back to front after the wall art and the shelves. */
const FLOOR_ORDER: RoomSlot[] = ['rug', 'corner', 'plant', 'desk'];

/** The furnished part: 960 wide, 600 tall, the floor from 430 down. */
export const STAGE = { w: 960, h: 600 };
const FLOOR = 430;
/** More room around the stage, in the scene's units: wall above and at the sides, floor below. */
export type RoomPad = { x: number; top: number; bottom: number };
const NO_PAD: RoomPad = { x: 0, top: 0, bottom: 0 };

// The floorboards: rows 46 tall from the wall down, each row's joints 260
// apart and shifted from the row above, for as much floor as there is.
const SEAMS = [120, 60, 180, 100];
function boards(x0: number, x1: number, bottom: number): string {
  let d = '';
  for (let k = 0, y = FLOOR; y < bottom; k++, y += 46) {
    const next = Math.min(bottom, y + 46);
    if (k > 0) d += `M${x0} ${y}H${x1}`;
    const first = SEAMS[k % SEAMS.length]! + 260 * Math.ceil((x0 - SEAMS[k % SEAMS.length]!) / 260);
    for (let x = first; x < x1; x += 260) d += `M${x} ${y}V${next}`;
  }
  return d;
}

export function RoomScene({ equipped, season, trophies, dropped, pad = NO_PAD, fill = false }: { equipped: Record<RoomSlot, string>; season: Season; trophies: Trophy[]; /** The item just placed: it drops in. */ dropped?: string | null; /** Room beyond the stage (the full-screen room). */ pad?: RoomPad; /** Fill the box it is in, instead of taking its height from its width. */ fill?: boolean }) {
  const x0 = -pad.x;
  const y0 = -pad.top;
  const w = STAGE.w + 2 * pad.x;
  const h = STAGE.h + pad.top + pad.bottom;
  const item = (slot: RoomSlot) => {
    const code = equipped[slot];
    return (
      <g key={code} className={code === dropped ? 'room-drop' : undefined}>
        {ROOM_ITEMS[code]}
      </g>
    );
  };
  const paper = WALLPAPER[equipped.wallpaper];
  const glows = [equipped.corner, equipped.desk].flatMap((code) => (GLOW[code] ? [{ code, ...GLOW[code] }] : []));
  return (
    <svg className={fill ? 'block size-full' : 'block h-auto w-full'} viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mako’s room" focusable="false">
      {/* the wall, papered as far as it goes */}
      <g key={equipped.wallpaper} className={equipped.wallpaper === dropped ? 'room-fade' : undefined}>
        {paper ? <rect x={x0} y={y0} width={w} height={FLOOR - y0} fill={`url(#${paper})`} /> : ROOM_ITEMS[equipped.wallpaper]}
      </g>
      <rect x={x0} y={y0} width={w} height={FLOOR - y0} fill="url(#roomWallShade)" />
      {/* a lantern hangs from the ceiling, however high that is */}
      {equipped.corner === 'corner_chiroq' && pad.top > 0 && <path d={`M338 ${y0}V0`} stroke="#6b4a2e" strokeWidth="3" strokeDasharray="6 3" />}

      {/* the window: today's season outside, the night sky in the dark theme */}
      <g>
        <rect x="60" y="70" width="230" height="230" rx="8" fill="#ffffff" stroke="#d6cbe9" strokeWidth="3" />
        <g clipPath="url(#roomWindowClip)">
          {WINDOW_VIEW[season]}
          <g className="room-night">
            <rect x="72" y="82" width="206" height="206" fill="#141842" opacity=".72" />
            <path d="M246 104A20 20 0 1 0 256 136A16 16 0 1 1 246 104Z" fill="#fff3bf" />
            <g fill="#fff8dc">
              <circle cx="98" cy="104" r="1.8" />
              <circle cx="150" cy="96" r="1.4" />
              <circle cx="196" cy="126" r="1.6" />
              <circle cx="120" cy="150" r="1.2" />
            </g>
          </g>
        </g>
        <path d="M175 82V288M72 185H278" stroke="#ffffff" strokeWidth="7" />
        <path d="M175 82V288M72 185H278" stroke="#d6cbe9" strokeWidth="2" />
        <rect x="48" y="296" width="254" height="14" rx="4" fill="#ffffff" stroke="#d6cbe9" strokeWidth="2" />
        <path d="M58 62C70 140 66 220 46 300H70C80 220 82 140 80 62Z" fill="#c9b6ee" opacity=".7" />
        <path d="M292 62C280 140 284 220 304 300H280C270 220 268 140 270 62Z" fill="#c9b6ee" opacity=".7" />
        <rect x="46" y="56" width="262" height="8" rx="4" fill="#8a5a3c" />
      </g>

      {item('art')}

      {/* the shelves: an achievement earned is its item, standing here */}
      <g>
        {SHELVES.map((y) => (
          <g key={y}>
            <rect x="642" y={y} width="276" height="10" rx="3" fill="#8a5a3c" />
            <path d={`M656 ${y + 10}H666V${y + 26}Z M894 ${y + 10}H904V${y + 26}Z`} fill="#6b4630" />
          </g>
        ))}
        {trophies.slice(0, SHELF_ROOM).map((t, k) => (
          <image key={t.code} href={`/achievements/items/${t.icon}.png`} x={648 + (k % PER_SHELF) * 27} y={SHELVES[Math.floor(k / PER_SHELF)]! - 24} width="24" height="24" className="room-trophy">
            <title>{t.title}</title>
          </image>
        ))}
      </g>

      {/* the floor, boarded as far as it goes */}
      <rect x={x0} y={FLOOR} width={w} height={y0 + h - FLOOR} fill="url(#roomFloor)" />
      <path d={boards(x0, x0 + w, y0 + h)} stroke="#b88a5c" strokeWidth="2" opacity=".55" fill="none" />
      <rect x={x0} y={FLOOR - 8} width={w} height="12" fill="#f4eee6" />

      {FLOOR_ORDER.map(item)}

      {/* night: the room dims, the lamps placed glow */}
      <rect className="room-night room-veil" x={x0} y={y0} width={w} height={h} fill="#0d0f2e" />
      <g className="room-night room-glows">
        {glows.map((g) => (
          <circle key={g.code} cx={g.cx} cy={g.cy} r={g.r} fill="url(#roomGlow)" />
        ))}
      </g>
    </svg>
  );
}

/** An item on its own: the same drawing through its slot's window. */
export function RoomThumb({ slot, code, className = '' }: { slot: RoomSlot; code: string; className?: string }) {
  return (
    <svg viewBox={THUMB_OF[code] ?? THUMB[slot]} className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      {ROOM_ITEMS[code]}
    </svg>
  );
}
