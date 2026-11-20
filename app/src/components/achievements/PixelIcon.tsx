// 16 × 16 pixel icons for the achievements and their toasts, drawn here as
// text (one letter per pixel, "." for none) and painted as SVG rectangles,
// so they stay crisp at any size. SATMAKON's own, in the spirit of the old
// games' advancement icons; never anyone else's textures.

const P: Record<string, string> = {
  k: '#1b1b1f', // outline
  w: '#ffffff',
  W: '#e4e4ec', // light grey
  g: '#9a9aa6', // grey
  G: '#5c5c66', // dark grey
  y: '#ffd43b', // gold
  Y: '#f2a900', // dark gold
  o: '#ff8c1a', // orange
  r: '#e03131', // red
  R: '#9c1b1b', // dark red
  p: '#f06595', // pink
  v: '#8b5cf6', // violet
  V: '#5b21b6', // dark violet
  b: '#3b82f6', // blue
  B: '#1d4ed8', // dark blue
  c: '#22d3ee', // cyan
  n: '#16a34a', // green
  N: '#14532d', // dark green
  t: '#c98b5e', // tan
  T: '#8a5a32', // brown
  s: '#fbb6ce', // panda cheeks
};

const ICONS: Record<string, string[]> = {
  // a four-point star (first XP)
  star: [
    '................',
    '.......k........',
    '......kyk.......',
    '......kyk.......',
    '.....kyyyk......',
    '.....kyyyk......',
    '.kkkkywyyykkkk..',
    '..kyyywwyyyyk...',
    '...kyyyyyyyk....',
    '....kyyyyyk.....',
    '.....kyyyk......',
    '....kyykyyk.....',
    '...kyyk.kyyk....',
    '..kyk.....kyk...',
    '..k.........k...',
    '................',
  ],
  // lightning (momentum)
  bolt: [
    '........kkkk....',
    '.......kyyyk....',
    '......kyyyk.....',
    '......kyyk......',
    '.....kyyyk......',
    '.....kyyk.......',
    '....kyyyykkkk...',
    '....kyyyyyyyk...',
    '...kkkkkyyyk....',
    '.......kyyk.....',
    '......kyyk......',
    '......kyk.......',
    '.....kyk........',
    '.....kk.........',
    '....kk..........',
    '....k...........',
  ],
  // a stack of coins (four digits)
  coins: [
    '................',
    '.....kkkkkk.....',
    '....kyyyyyyk....',
    '...kyYyyyyYyk...',
    '...kyyYYYYyyk...',
    '...kkyyyyyykk...',
    '..kyykkkkkkyyk..',
    '..kyYyyyyyyYyk..',
    '..kyyYYYYYYyyk..',
    '..kkyyyyyyyykk..',
    '.kyykkkkkkkkyyk.',
    '.kyYyyyyyyyyYyk.',
    '.kyyYYYYYYYYyyk.',
    '.kkyyyyyyyyyykk.',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  // a diploma (Scholar)
  scroll: [
    '................',
    '..kkkkkkkkkkk...',
    '.kWwwwwwwwwwWk..',
    '.kwkkkkkkkkkwk..',
    '.kwwwwwwwwwwwk..',
    '.kwkkkkkkkwwwk..',
    '.kwwwwwwwwwwwk..',
    '.kwkkkkkkkkkwk..',
    '.kwwwwwwwwwwwk..',
    '.kwkkkkkkwwwwk..',
    '.kwwwwwwwkrkwk..',
    '.kWwwwwwkrrrkWk.',
    '..kkkkkkkrkrkk..',
    '........krkrk...',
    '.........k.k....',
    '................',
  ],
  // a crown (Double Digits)
  crown: [
    '................',
    '................',
    '..k.........k...',
    '.kyk...k...kyk..',
    '.kyk..kyk..kyk..',
    '.kyyk.kyk.kyyk..',
    '.kyyykkyykkyyk..',
    '.kyyyyyyyyyyyk..',
    '.kyyryyyyybyyk..',
    '.kyyyyyyyyyyyk..',
    '.kYYYYYYYYYYYk..',
    '.kyyyyyyyyyyyk..',
    '.kYYYYYYYYYYYk..',
    '..kkkkkkkkkkk...',
    '................',
    '................',
  ],
  // a flame (streaks)
  flame: [
    '................',
    '.......k........',
    '......kok.......',
    '......kok.......',
    '.....koook......',
    '....kooook.k....',
    '....koooookok...',
    '...kooyyoooook..',
    '...koyyyyooook..',
    '...koyyyyyoook..',
    '..kooyywyyoook..',
    '..kooyywyyyook..',
    '..kkooyyyyookk..',
    '...kkoooooookk..',
    '.....kkkkkkk....',
    '................',
  ],
  // a shield (Week Warrior)
  shield: [
    '................',
    '..kkkkkkkkkkk...',
    '.kvvvvvvvvvvvk..',
    '.kvwwvvvvvwwvk..',
    '.kvwyyyyyyywvk..',
    '.kvvyVVVVVyvvk..',
    '.kvvyVvvvVyvvk..',
    '.kvvyVvwvVyvvk..',
    '.kvvyVvvvVyvvk..',
    '..kvyVVVVVyvk...',
    '..kvvyyyyyvvk...',
    '...kvvvvvvvk....',
    '....kvvvvvk.....',
    '.....kvvvk......',
    '......kkk.......',
    '................',
  ],
  // a heart (Month of Momentum)
  heart: [
    '................',
    '...kkk...kkk....',
    '..krrrk.krrrk...',
    '.krwrrrkrrrrrk..',
    '.krwrrrrrrrrrk..',
    '.krrrrrrrrrrrk..',
    '.krrrrrrrrrrrk..',
    '..krrrrrrrrrk...',
    '..kRrrrrrrrRk...',
    '...kRrrrrrRk....',
    '....kRrrrRk.....',
    '.....kRrRk......',
    '......kRk.......',
    '.......k........',
    '................',
    '................',
  ],
  // a target (Century)
  target: [
    '................',
    '.....kkkkkk.....',
    '....krrrrrrk....',
    '...krwwwwwwrk...',
    '..krwrrrrrrwrk..',
    '..krwrwwwwrwrk..',
    '.krwrwrrrrwrwrk.',
    '.krwrwrkkrwrwrk.',
    '.krwrwrkkrwrwrk.',
    '.krwrwrrrrwrwrk.',
    '..krwrwwwwrwrk..',
    '..krwrrrrrrwrk..',
    '...krwwwwwwrk...',
    '....krrrrrrk....',
    '.....kkkkkk.....',
    '................',
  ],
  // a pencil (Five Hundred)
  pencil: [
    '................',
    '............kk..',
    '...........kppk.',
    '..........kpppk.',
    '.........kyyypk.',
    '........kyyyyk..',
    '.......kyyyyk...',
    '......kyyyyk....',
    '.....kyyyyk.....',
    '....kyyyyk......',
    '...kttyyk.......',
    '..kttttk........',
    '..kkttk.........',
    '..kkkk..........',
    '..kk............',
    '................',
  ],
  // a trophy (Two Thousand)
  trophy: [
    '................',
    '..kkkkkkkkkkk...',
    '.kkyyyyyyyyykk..',
    'kykyyyyyyyyykyk.',
    'kykyyywyyyyykyk.',
    'kykyyywyyyyykyk.',
    '.kkyyyyyyyyykk..',
    '..kyyyyyyyyyk...',
    '...kyyyyyyyk....',
    '....kYyyyYk.....',
    '.....kyyyk......',
    '......kyk.......',
    '....kkkYkkk.....',
    '...kTTTTTTTk....',
    '...kkkkkkkkk....',
    '................',
  ],
  // a ticked box (Quest Habit)
  check: [
    '................',
    '.kkkkkkkkkkkkk..',
    '.kwwwwwwwwwwwk..',
    '.kwwwwwwwwwkwk..',
    '.kwwwwwwwwknwk..',
    '.kwwwwwwwknnwk..',
    '.kwwwwwwknnkwk..',
    '.kwkwwwwknnkwk..',
    '.kwknkwknnkwwk..',
    '.kwknnknnnkwwk..',
    '.kwwknnnnkwwwk..',
    '.kwwwknnkwwwwk..',
    '.kwwwwkkwwwwwk..',
    '.kwwwwwwwwwwwk..',
    '.kkkkkkkkkkkkk..',
    '................',
  ],
  // a book (Quest Regular)
  book: [
    '................',
    '..kkkkkkkkkkk...',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvyyyyyvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVvvvvvvvvvvk..',
    '.kVkkkkkkkkkkk..',
    '.kVwwwwwwwwwwk..',
    '.kkkkkkkkkkkk...',
    '................',
    '................',
  ],
  // a compass (quests done)
  compass: [
    '................',
    '.....kkkkkk.....',
    '....kWWWWWWk....',
    '...kWwwwwwwWk...',
    '..kWwwwkkwwwWk..',
    '..kWwwkrrkwwWk..',
    '.kWwwkrrrrkwwWk.',
    '.kWwwkrrkkkwwWk.',
    '.kWwwkkkbbkwwWk.',
    '.kWwwkbbbbkwwWk.',
    '..kWwwkbbkwwWk..',
    '..kWwwwkkwwwWk..',
    '...kWwwwwwwWk...',
    '....kWWWWWWk....',
    '.....kkkkkk.....',
    '................',
  ],
  // a padlock (not yet)
  lock: [
    '................',
    '.....kkkkkk.....',
    '....kggggggk....',
    '...kggkkkkggk...',
    '...kgk....kgk...',
    '...kgk....kgk...',
    '..kkkkkkkkkkkk..',
    '..kGGGGGGGGGGk..',
    '..kGGGGkkGGGGk..',
    '..kGGGkggkGGGk..',
    '..kGGGGkkGGGGk..',
    '..kGGGGkkGGGGk..',
    '..kGGGGGGGGGGk..',
    '..kGGGGGGGGGGk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  // a graduation cap (Graduation: a roadmap course finished)
  cap: [
    '................',
    '.......kk.......',
    '.....kkkkkk.....',
    '...kkkkkkkkkk...',
    '.kkkkkkkkkkkkkk.',
    'kkkkkkkkkkkkkkkk',
    '.kkkkkkkkkkkkkkk',
    '...kkkkkkkkkkkyk',
    '....kkkkkkkk.kyk',
    '....kGkkkkGk.kyk',
    '....kGGGGGGk.kyk',
    '.....kGGGGk..kyk',
    '......kkkk...kyk',
    '............kyyk',
    '............kyyk',
    '.............kk.',
  ],
  // a cobweb (not an achievement)
  cobweb: [
    'W..............W',
    '.W.....W.....W..',
    '..W....W....W...',
    '...W...W...W....',
    '....WWWWWWW.....',
    '.....W.W.W......',
    '......WWW.......',
    'WWWWWWWWWWWWWWW.',
    '......WWW.......',
    '.....W.W.W......',
    '....WWWWWWW.....',
    '...W...W...W....',
    '..W....W....W...',
    '.W.....W.....W..',
    'W..............W',
    '................',
  ],
  // Mako (a level reached)
  mako: [
    '................',
    '..kkk......kkk..',
    '.kkkkkkkkkkkkkk.',
    '.kkkwwwwwwwwkkk.',
    '..kwwwwwwwwwwk..',
    '..kwkkkwwkkkwk..',
    '..kwkwkwwkwkwk..',
    '..kwkkkwwkkkwk..',
    '..kwwwwkkwwwwk..',
    '..kwswwwwwwswk..',
    '..kwwwwkkwwwwk..',
    '...kwwwwwwwwk...',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
  ],
};

export type PixelIconName = keyof typeof ICONS;

/** The icon for an achievement code (one per family); `lock` for the rest. */
export const ICON_OF: Record<string, PixelIconName> = {
  first_xp: 'star', xp_500: 'bolt', xp_1000: 'coins', level_5: 'scroll', level_10: 'crown',
  streak_3: 'flame', streak_7: 'shield', streak_30: 'heart', answers_100: 'target', answers_500: 'pencil', answers_2000: 'trophy',
  quests_5: 'check', quests_25: 'book',
};

/** Rows of same-colour runs, so an icon is a few dozen rectangles, not 256. */
function runs(rows: string[]) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x]!;
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== '.' && P[c]) out.push({ x, y, w, fill: P[c]! });
      x += w;
    }
  });
  return out;
}

const cache = new Map<string, ReturnType<typeof runs>>();

export function PixelIcon({ name, size = 32, className = '', dim = false }: { name: PixelIconName | string; size?: number; className?: string; /** Grey, for an achievement not yet earned. */ dim?: boolean }) {
  const rows = ICONS[name] ?? ICONS.lock!;
  let r = cache.get(name);
  if (!r) {
    r = runs(rows);
    cache.set(name, r);
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" className={className} style={dim ? { filter: 'grayscale(1) opacity(0.55)' } : undefined} aria-hidden="true">
      {r.map((q, i) => (
        <rect key={i} x={q.x} y={q.y} width={q.w} height={1} fill={q.fill} />
      ))}
    </svg>
  );
}

// ---- frames: the background behind an icon, the three kinds cut from the
// reference (public/achievements/frame-<shape>-<state>.png): a square for an
// achievement, a rounded one for a goal (our quests), a jagged one for a
// challenge; light grey once completed, purple until then.

export type FrameShape = 'advancement' | 'goal' | 'challenge';

/** An icon in its frame: the shape says what kind it is, the colour whether it's done. */
export function Badge({ icon, shape, done, size = 48, className = '' }: { icon: PixelIconName | string; shape: FrameShape; done: boolean; size?: number; className?: string }) {
  return (
    <span className={`mc-badge ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={`/achievements/frame-${shape}-${done ? 'done' : 'todo'}.png`} alt="" draggable={false} />
      <PixelIcon name={icon} size={Math.round(size * 0.62)} />
    </span>
  );
}
