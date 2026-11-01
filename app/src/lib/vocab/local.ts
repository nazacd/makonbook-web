// A person's vocabulary settings and sync state in this browser (the
// phone's src/lib/vocab/local.ts, on localStorage).

export type Settings = {
  /** The lists turned on, by slug. */
  active: string[];
  newPerDay: number;
  /** False until the person changes a setting in this browser. */
  saved?: boolean;
};

export const NEW_PER_DAY = [10, 20, 30, 50];

const key = (person: string, what: string) => `mb.vocab.${person}.${what}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    // Storage blocked: the page keeps working from memory.
  }
}

export const loadSettings = (p: string) => read<Settings>(key(p, 'settings'), { active: [], newPerDay: 20, saved: false });
export const saveSettings = (p: string, s: Settings) => write(key(p, 'settings'), { ...s, saved: true });

/** Reviews made here that the server hasn't confirmed yet, by id. */
export const loadPending = (p: string) => read<string[]>(key(p, 'pending'), []);
export const savePending = (p: string, ids: string[]) => write(key(p, 'pending'), ids);

/** The last server seq this browser has fetched reviews up to. */
export const loadCursor = (p: string) => read<number>(key(p, 'cursor'), 0);
export const saveCursor = (p: string, seq: number) => write(key(p, 'cursor'), seq);
