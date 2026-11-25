import type { ReactNode } from 'react';

import type { Season } from '@/lib/season';

import { GLOW, ROOM_ITEMS, THUMB, WINDOW_VIEW, type RoomSlot } from './items';

// Mako's room, drawn (spec 28): a wall with its paper, a window onto the
// season, the wall art, three shelves for the achievements earned, the
// floor with a rug, a light, a plant and the furniture. In the dark theme
// it is night: a veil over the room, the sky dark in the window, and the
// lamps that are placed glow (--room-night in styles.css). The drawings are
// in items.tsx; RoomDefs must be on the page.

export type Trophy = { code: string; title: string; icon: string };

/** How many trophies the three shelves hold. */
export const SHELF_ROOM = 30;
const SHELVES = [78, 168, 258];
const PER_SHELF = 10;

/** Back to front after the wall art and the shelves. */
const FLOOR_ORDER: RoomSlot[] = ['rug', 'corner', 'plant', 'desk'];

export function RoomScene({ equipped, season, trophies, dropped, children }: { equipped: Record<RoomSlot, string>; season: Season; trophies: Trophy[]; /** The item just placed: it drops in. */ dropped?: string | null; children?: ReactNode }) {
  const item = (slot: RoomSlot) => {
    const code = equipped[slot];
    return (
      <g key={code} className={code === dropped ? (slot === 'wallpaper' ? 'room-fade' : 'room-drop') : undefined}>
        {ROOM_ITEMS[code]}
      </g>
    );
  };
  const glows = [equipped.corner, equipped.desk].flatMap((code) => (GLOW[code] ? [{ code, ...GLOW[code] }] : []));
  return (
    <svg className="block h-auto w-full" viewBox="0 0 960 600" role="img" aria-label="Mako’s room" focusable="false">
      {/* the wall */}
      {item('wallpaper')}
      <rect width="960" height="430" fill="url(#roomWallShade)" />

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

      {/* the floor */}
      <rect y="430" width="960" height="170" fill="url(#roomFloor)" />
      <g stroke="#b88a5c" strokeWidth="2" opacity=".55">
        <path d="M0 468H960M0 512H960M0 560H960" />
        <path d="M120 430V468M380 430V468M640 430V468M880 430V468M60 468V512M300 468V512M560 468V512M820 468V512M180 512V560M440 512V560M700 512V560M940 512V560M100 560V600M360 560V600M620 560V600M860 560V600" />
      </g>
      <rect y="422" width="960" height="12" fill="#f4eee6" />

      {FLOOR_ORDER.map(item)}

      {/* night: the room dims, the lamps placed glow */}
      <rect className="room-night room-veil" width="960" height="600" fill="#0d0f2e" />
      <g className="room-night room-glows">
        {glows.map((g) => (
          <circle key={g.code} cx={g.cx} cy={g.cy} r={g.r} fill="url(#roomGlow)" />
        ))}
      </g>
      {children}
    </svg>
  );
}

/** An item on its own: the same drawing through its slot's window. */
export function RoomThumb({ slot, code, className = '' }: { slot: RoomSlot; code: string; className?: string }) {
  return (
    <svg viewBox={THUMB[slot]} className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      {ROOM_ITEMS[code]}
    </svg>
  );
}
