import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { needsPhone } from '@/api/accounts';
import { useGamification, type Gamification } from '@/api/gamification';
import { useMe } from '@/api/queries';
import { newItems, useRoom, type Room } from '@/api/room';
import { ICON, iconOf } from '@/components/achievements/catalogue';
import { ItemIcon } from '@/components/achievements/Icons';
import { usePerson } from '@/lib/practice/hooks';
import { burst } from '@/lib/season';
import { chime } from '@/lib/sounds';

// Achievement toasts, the old games' way: a slab with the item's icon slides
// in at the top right, holds a few seconds, slides out; the next one waits its turn. One
// fires for every achievement unlocked and every quest done since this
// browser last looked, so work finished on the phone shows up here too. The
// first look on a device marks everything as seen without a toast. Pressing
// a toast opens the Progress page. Things newly unlocked for Mako's room
// (spec 28) get one toast between them, which opens the room.

type Toast = { id: string; kind: 'achievement' | 'challenge' | 'quest' | 'none' | 'nudge' | 'room'; title: string; icon: string };
type Seen = { achievements: Record<string, string>; quests: Record<string, string> };

const HOLD = 5000;
const SLIDE = 450;

function seenKey(person: string) {
  return `mb.toasts.seen.${person}`;
}
function readSeen(person: string): Seen | null {
  try {
    const raw = localStorage.getItem(seenKey(person));
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}
function writeSeen(person: string, seen: Seen) {
  try {
    localStorage.setItem(seenKey(person), JSON.stringify(seen));
  } catch {
    // Not kept: the same toasts may show again next time.
  }
}

/** What g holds that `seen` doesn't; and the record to keep afterwards. */
export function fresh(g: Gamification, seen: Seen | null, now = new Date(), room?: Room): { toasts: Toast[]; seen: Seen } {
  const next: Seen = { achievements: {}, quests: {} };
  const toasts: Toast[] = [];
  for (const a of g.achievements) {
    if (!a.unlocked_at) continue;
    next.achievements[a.code] = a.unlocked_at;
    if (seen && seen.achievements[a.code] !== a.unlocked_at) {
      toasts.push({ id: `a:${a.code}:${a.unlocked_at}`, kind: a.tier === 'challenge' ? 'challenge' : 'achievement', title: a.title, icon: iconOf(a.code) });
    }
  }
  for (const q of [...g.quests.daily, ...g.quests.weekly]) {
    if (!q.done_at) continue;
    next.quests[`${q.code}@${q.done_at}`] = q.done_at;
    if (seen && !seen.quests[`${q.code}@${q.done_at}`]) toasts.push({ id: `q:${q.code}:${q.done_at}`, kind: 'quest', title: q.title, icon: ICON.quest });
  }
  // Back after a week of nothing: a cobweb, once per such gap. Not an achievement.
  const days = g.streak.days;
  const dead = days.slice(-7).every((d) => !d.active);
  const lastActive = [...days].reverse().find((d) => d.active)?.day;
  if (dead && lastActive) {
    const key = `cobwebs@${lastActive}`;
    next.quests[key] = lastActive;
    if (seen && !seen.quests[key]) toasts.push({ id: `n:${key}`, kind: 'none', title: 'A week of cobwebs', icon: ICON.cobwebs });
  }
  // Evening, and nothing done today: one nudge a day, in the old games' oldest words.
  if (now.getHours() >= 18 && !g.streak.active_today && g.xp_total > 0) {
    const key = `nudge@${g.streak.days.at(-1)?.day ?? ''}`;
    next.quests[key] = key;
    if (seen && !seen.quests[key]) toasts.push({ id: `g:${key}`, kind: 'nudge', title: 'please lock in', icon: ICON.nudge });
  }
  // New things for Mako's room: one toast for the lot, once per set of them.
  const items = room ? newItems(room) : [];
  if (items.length > 0) {
    const key = `room@${items.map((i) => i.code).sort().join(',')}`;
    next.quests[key] = key;
    if (seen && !seen.quests[key]) toasts.push({ id: `r:${key}`, kind: 'room', title: items.length === 1 ? items[0]!.name : `${items.length} new things`, icon: ICON.room });
  }
  return { toasts, seen: next };
}

export function AchievementToasts() {
  const me = useMe().data;
  const person = usePerson();
  const student = me?.kind === 'student' && !needsPhone(me);
  const g = useGamification(student).data;
  const room = useRoom(student).data;
  const inRoom = useLocation().pathname === '/room';
  const [queue, setQueue] = useState<Toast[]>([]);
  const [shown, setShown] = useState(false);
  const navigate = useNavigate();
  const timers = useRef<number[]>([]);

  // New unlocks since the last look go on the queue.
  useEffect(() => {
    if (!g || !student) return;
    const had = readSeen(person);
    // In the room itself the page says what is new: no toast on top of it.
    const { toasts: all, seen } = fresh(g, had, new Date(), room);
    writeSeen(person, seen);
    const toasts = inRoom ? all.filter((t) => t.kind !== 'room') : all;
    if (!toasts.length) return;
    const t = window.setTimeout(() => setQueue((q) => [...q, ...toasts.filter((x) => !q.some((y) => y.id === x.id))]), 0);
    return () => clearTimeout(t);
  }, [g, room, inRoom, person, student]);

  // One at a time: in, hold, out, next.
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t1 = window.setTimeout(() => {
      setShown(true);
      if (current.kind === 'nudge' || current.kind === 'room') chime('quest');
      else if (current.kind !== 'none') {
        chime(current.kind);
        burst(current.kind === 'challenge' ? 30 : 16);
      }
    }, 50);
    const t2 = window.setTimeout(() => setShown(false), HOLD);
    const t3 = window.setTimeout(() => setQueue((q) => q.slice(1)), HOLD + SLIDE);
    timers.current = [t1, t2, t3];
    return () => timers.current.forEach(clearTimeout);
  }, [current]);

  if (!current) return null;
  const head = { achievement: 'Achievement unlocked!', challenge: 'Challenge complete!', quest: 'Quest done!', none: 'Not an achievement', nudge: 'Achievement get!', room: 'New for Mako’s room!' }[current.kind];
  return (
    <div className="mc-toasts" aria-live="polite">
      <button
        type="button"
        className={`mc-toast ${shown ? 'is-in' : ''}`}
        data-kind={current.kind}
        onClick={() => {
          timers.current.forEach(clearTimeout);
          setShown(false);
          setQueue([]);
          void navigate(current.kind === 'nudge' ? '/' : current.kind === 'room' ? '/room' : '/progress');
        }}
        aria-label={`${head} ${current.title}. ${current.kind === 'nudge' ? 'Open the dashboard.' : current.kind === 'room' ? 'Open the room.' : 'Open your progress.'}`}>
        <span className="mc-toast-icon">
          <ItemIcon name={current.icon} size={32} />
        </span>
        <span className="mc-toast-text">
          <span className="mc-toast-head">{head}</span>
          <span className="mc-toast-title">{current.title}</span>
        </span>
      </button>
    </div>
  );
}
