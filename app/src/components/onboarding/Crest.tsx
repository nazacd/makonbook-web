// A university without a logo gets a crest: its initials on a shield, in a
// colour of its own (from its id, so it never changes).

const HUES = [262, 222, 198, 168, 28, 344, 290, 12, 45, 140];
const SMALL = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'le', 'du', 'des', 'di', 'der', 'und', 'at', 'in']);

export function initials(name: string): string {
  const short = name.match(/\(([A-Z]{2,6})\)/)?.[1];
  if (short) return short;
  const words = name.replace(/\(.*?\)/g, '').split(/[\s,–-]+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
  return words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('');
}

function hue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length]!;
}

export function Crest({ id, name, size }: { id: string; name: string; size: number }) {
  const h = hue(id);
  const letters = initials(name);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`crest-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 70% 58%)`} />
          <stop offset="1" stopColor={`hsl(${h} 72% 34%)`} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`hsl(${h} 40% 14%)`} />
      <path d="M50 14 L78 24 V48 C78 66 66 79 50 86 C34 79 22 66 22 48 V24 Z" fill={`url(#crest-${id})`} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <text x="50" y="56" textAnchor="middle" fontSize={letters.length > 2 ? 17 : 22} fontWeight="800" fill="#fff" fontFamily="inherit" letterSpacing="0.5">
        {letters}
      </text>
    </svg>
  );
}

const RINGS = {
  gold: '0 0 0 3px rgba(246,195,67,0.9), 0 0 28px rgba(246,195,67,0.45)',
  white: '0 0 0 3px rgba(255,255,255,0.85), 0 0 24px rgba(246,195,67,0.4)',
  medal: '0 0 0 4px #ffe08a, 0 0 44px rgba(246,195,67,0.65)',
};

/**
 * A university's badge: its logo cut in a circle, else its crest. `ring`
 * draws a glowing ring on the badge itself (a box exactly its size, so the
 * ring is even all round).
 */
export function UniversityBadge({ id, name, logo, size, ring }: { id: string; name: string; logo: string | null; size: number; ring?: keyof typeof RINGS }) {
  return (
    <span className={`flex shrink-0 overflow-hidden rounded-full ${logo ? 'bg-white' : ''}`} style={{ width: size, height: size, boxShadow: ring ? RINGS[ring] : undefined }}>
      {logo ? <img src={logo} alt="" width={size} height={size} draggable={false} className="block size-full object-cover" /> : <Crest id={id} name={name} size={size} />}
    </span>
  );
}
