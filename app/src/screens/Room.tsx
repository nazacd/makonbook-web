import { Armchair, Check, Flower2, Grid3x3, Image, LampDesk, Lightbulb, Lock, Palette, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useGamification, xp } from '@/api/gamification';
import { equippedOf, newItems, useEquip, useRoom, useSeenRoom, type Room as RoomData, type RoomItem } from '@/api/room';
import { iconOf } from '@/components/achievements/catalogue';
import { Panda, type PandaHandle } from '@/components/mascot/Panda';
import { RoomDefs, type RoomSlot } from '@/components/room/items';
import { RoomScene, RoomThumb, SHELF_ROOM, STAGE, type RoomPad, type Trophy as ShelfTrophy } from '@/components/room/Scene';
import { ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/ui';
import { LINES, say } from '@/lib/mako';
import { burstFrom, useSeason } from '@/lib/season';
import { useTitle } from '@/lib/title';

// "/room": Mako's room (spec 28), drawn with what is placed in it and with
// Mako on the rug, and a picker with a tab per slot. On a laptop the room is
// the whole page: its wall and floor carry on to fill the space beside the
// sidebar, the title and the figures float at the top, and the picker is a
// dock along the bottom; the furnished part always fits between them. On a
// phone the room is on top and the picker under it. Pressing an unlocked
// item places it at once (saved to the server, put back if that fails);
// pressing a locked one shows it in the room for a moment, with what it
// takes. Mako says what is nearest to opening, tells about the item under
// the pointer and reacts to what is done. Everything is for show: nothing
// changes a score.

const SLOT_ICON: Record<RoomSlot, LucideIcon> = { wallpaper: Palette, art: Image, rug: Grid3x3, desk: LampDesk, corner: Lightbulb, plant: Flower2 };
const PREVIEW_MS = 2800;
const LINE_MS = 3600;
/** The full-screen room: what the top bar and the dock take, in pixels (with their margins). */
const TOP = 72;
const DOCK = 152;
const WIDE = '(min-width: 1024px) and (min-height: 560px)';

/** A laptop-sized window: the room is the whole page. */
function useFullScreen(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/** Where the 960 × 600 stage sits in a box, and how much room is around it. */
function layoutOf(w: number, h: number): { pad: RoomPad; stage: { left: number; top: number; width: number; height: number } } {
  const scale = Math.max(0.2, Math.min(w / STAGE.w, (h - TOP - DOCK) / STAGE.h));
  const x = Math.max(0, (w / scale - STAGE.w) / 2);
  const top = TOP / scale;
  return { pad: { x, top, bottom: Math.max(0, h / scale - STAGE.h - top) }, stage: { left: x * scale, top: TOP, width: STAGE.w * scale, height: STAGE.h * scale } };
}

export function Room() {
  useTitle('Mako’s room');
  const room = useRoom();
  if (room.data) {
    return (
      <>
        <RoomDefs />
        <Loaded room={room.data} />
      </>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader icon={Armchair} title="Mako’s room" />
      {room.isPending ? <Skeleton height={480} radius={20} /> : <ErrorState title="The room didn’t load" message={describeError(room.error)} onRetry={() => void room.refetch()} retrying={room.isFetching} />}
    </div>
  );
}

/** What Mako says when nothing else is going on: the item nearest to opening. */
function hint(room: RoomData): string {
  const locked = room.slots.flatMap((s) => s.items).filter((i) => !i.unlocked && i.requirement);
  if (locked.length === 0) return 'Everything in here, you earned. I love this room.';
  const next = locked.reduce((a, b) => (b.requirement!.progress / b.requirement!.target > a.requirement!.progress / a.requirement!.target ? b : a));
  const r = next.requirement!;
  return `Next for the room: ${next.name}. ${r.label} (${xp(r.progress)} of ${xp(r.target)}).`;
}

/** What he says when there are new things: their names, or how many when there are a lot. */
function welcome(room: RoomData, fresh: Set<string>): string {
  const names = room.slots.flatMap((s) => s.items).filter((i) => fresh.has(i.code)).map((i) => i.name);
  return names.length > 3 ? `${names.length} new things for the room. Look for the New tags and try them on.` : `New for the room: ${names.join(', ')}. Try ${names.length === 1 ? 'it' : 'them'} on.`;
}

function Loaded({ room }: { room: RoomData }) {
  const { season } = useSeason();
  const g = useGamification().data;
  const equip = useEquip();
  const seen = useSeenRoom();
  const full = useFullScreen();
  const panda = useRef<PandaHandle>(null);
  const mako = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<RoomSlot>(() => (newItems(room)[0] ? room.slots.find((s) => s.items.some((i) => i.is_new))!.key : 'wallpaper'));
  // The items that were new when the page opened: tagged until it is left.
  const [fresh] = useState(() => new Set(newItems(room).map((i) => i.code)));
  const [preview, setPreview] = useState<{ slot: RoomSlot; item: RoomItem } | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [shaken, setShaken] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [about, setAbout] = useState<string | null>(null); // the item under the pointer, in his words
  const previewTimer = useRef(0);
  const lineTimer = useRef(0);
  // The full-screen room's box, measured: the scene is drawn to its shape.
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    watch.observe(el);
    return () => watch.disconnect();
  }, [full]);

  const speak = (text: string, ms = LINE_MS) => {
    setLine(text);
    panda.current?.talk(Math.min(1600, 40 * text.length));
    clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), ms);
  };

  // A moment after the room is up: a hello, or a celebration of what is new
  // (which is then marked as shown).
  const markSeen = seen.mutate;
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (fresh.size > 0) {
        panda.current?.set('celebrate', 2400);
        burstFrom(mako.current, 26);
        markSeen();
      } else panda.current?.set('greet', 1800);
    }, 500);
    return () => clearTimeout(t);
  }, [fresh, markSeen]);
  useEffect(
    () => () => {
      clearTimeout(previewTimer.current);
      clearTimeout(lineTimer.current);
    },
    [],
  );

  const placed = equippedOf(room);
  const shown = preview ? { ...placed, [preview.slot]: preview.item.code } : placed;
  const slot = room.slots.find((s) => s.key === tab) ?? room.slots[0]!;
  const earned = (g?.achievements ?? []).filter((a) => a.unlocked_at).sort((a, b) => a.unlocked_at!.localeCompare(b.unlocked_at!));
  const trophies: ShelfTrophy[] = earned.slice(-SHELF_ROOM).map((a) => ({ code: a.code, title: a.title, icon: iconOf(a.code) }));

  const pick = (item: RoomItem) => {
    clearTimeout(previewTimer.current);
    setAbout(null);
    if (!item.unlocked) {
      // A look at it in the room, then back.
      setPreview({ slot: slot.key, item });
      setDropped(item.code);
      setShaken(item.code);
      previewTimer.current = window.setTimeout(() => setPreview(null), PREVIEW_MS);
      panda.current?.set('thinking', 1800);
      const r = item.requirement;
      speak(r ? `Not ours yet. ${r.label}: ${xp(r.progress)} of ${xp(r.target)} so far.` : 'Not ours yet.');
      return;
    }
    setPreview(null);
    if (item.equipped) {
      panda.current?.set('happy', 900);
      return;
    }
    setDropped(item.code);
    // Something new placed for the first time gets a little more.
    panda.current?.set(fresh.has(item.code) ? 'love' : 'happy', 1500);
    speak(fresh.has(item.code) ? `${item.name}! We earned that one.` : `${item.name}. Nice choice.`, 2400);
    equip.mutate(
      { slot: slot.key, item: item.code },
      {
        onError: () => {
          panda.current?.set('worried', 1800);
          speak('That didn’t save. Try it again in a moment.');
        },
      },
    );
  };
  /** What he says about an item the pointer is on. */
  const tell = (item: RoomItem) => setAbout(item.unlocked || !item.requirement ? `${item.name}. ${item.blurb}` : `${item.name}: ${item.requirement.label.toLowerCase()} (${xp(item.requirement.progress)} of ${xp(item.requirement.target)}).`);

  const stats: { label: string; value: string; of?: string; to?: string }[] = [
    { label: 'Level', value: String(room.level) },
    { label: 'Items', value: String(room.items_unlocked), of: `/${room.items_total}` },
    ...(g ? [{ label: 'Trophies', value: String(earned.length), of: `/${g.achievements.length}`, to: '/progress' }] : []),
  ];
  const says = line ?? about ?? (fresh.size > 0 ? welcome(room, fresh) : hint(room));

  const makoButton = (
    <button
      ref={mako}
      type="button"
      onClick={() => {
        panda.current?.set('happy', 1700);
        speak(say(LINES.poke), 2600);
      }}
      onDoubleClick={() => {
        panda.current?.set('celebrate', 2100);
        burstFrom(mako.current, 22);
      }}
      onPointerEnter={() => panda.current?.perk()}
      className="room-mako absolute bottom-[7%] left-[41%] w-[15.5%] rounded-[40%]"
      aria-label="Mako the panda. Press to say hi.">
      <Panda ref={panda} season={season} className="h-auto w-full" />
    </button>
  );
  const bubble = (
    <p className="room-say" aria-live="polite">
      <span className="mk-say-name">Mako</span>
      <span className="t-footnote font-semibold text-ink">{says}</span>
    </p>
  );
  const previewTag = preview && (
    <p className="fade flex max-w-full items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-[12px] font-semibold text-paper backdrop-blur-sm" role="status">
      <Lock size={12} aria-hidden="true" /> A look at {preview.item.name}
    </p>
  );
  const stat = (s: (typeof stats)[number], glass: boolean): ReactNode => {
    const inner = (
      <>
        <dt className="t-micro text-ink-3">{s.label}</dt>
        <dd className="t-number text-[20px] leading-6 text-ink">
          {s.value}
          {s.of && <span className="text-[13px] font-semibold text-ink-3">{s.of}</span>}
        </dd>
      </>
    );
    const look = `block min-w-[76px] rounded-control border border-line px-3 py-1.5 ${glass ? 'room-glass' : 'bg-surface py-2'}`;
    return s.to ? (
      <Link key={s.label} to={s.to} title="See every achievement" className={`${look} transition-colors hover:border-primary`}>
        {inner}
      </Link>
    ) : (
      <div key={s.label} className={look}>
        {inner}
      </div>
    );
  };
  const tabButton = (s: RoomData['slots'][number], dock: boolean) => {
    const I = SLOT_ICON[s.key];
    const on = s.key === slot.key;
    const hasNew = s.items.some((i) => fresh.has(i.code));
    const count = `${s.items.filter((i) => i.unlocked).length}/${s.items.length}`;
    return (
      <button
        key={s.key}
        type="button"
        role="tab"
        id={`room-tab-${s.key}`}
        aria-selected={on}
        aria-controls="room-items"
        onClick={() => setTab(s.key)}
        className={`relative flex items-center rounded-control border transition-colors ${dock ? 'h-9 shrink-0 gap-1.5 px-3' : 'flex-col gap-0.5 px-1 py-2'} ${on ? 'border-primary bg-accent-tint text-accent' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'}`}>
        <I size={dock ? 15 : 17} aria-hidden="true" />
        <span className={`font-bold ${dock ? 'text-[13px]' : 'text-[11.5px] leading-4'}`}>{s.label}</span>
        <span className={`tabular font-semibold opacity-80 ${dock ? 'text-[11.5px]' : 'text-[10.5px] leading-3'}`}>{count}</span>
        {hasNew && <span className={`absolute size-2 rounded-full bg-fill-watch ${dock ? 'right-1 top-1' : 'right-1.5 top-1.5'}`} aria-label="Something new" />}
      </button>
    );
  };
  const card = (item: RoomItem, dock: boolean) => {
    const r = item.requirement;
    const locked = !item.unlocked && r;
    return (
      <li key={item.code} className={dock ? 'min-w-[196px] flex-1' : ''}>
        <button
          type="button"
          onClick={() => pick(item)}
          onPointerEnter={() => tell(item)}
          onPointerLeave={() => setAbout(null)}
          onFocus={() => tell(item)}
          onBlur={() => setAbout(null)}
          onAnimationEnd={() => setShaken(null)}
          aria-pressed={item.equipped}
          className={`lift grid w-full items-center gap-2.5 rounded-control border bg-surface text-left ${dock ? 'h-[68px] grid-cols-[72px_minmax(0,1fr)_18px] p-1.5 pr-2.5' : 'grid-cols-[88px_minmax(0,1fr)_20px] p-2'} ${item.equipped ? 'border-primary shadow-[0_0_0_3px_var(--color-accent-tint)]' : 'border-line'} ${shaken === item.code ? 'room-shake' : ''}`}>
          <RoomThumb slot={slot.key} code={item.code} className={`rounded-[10px] bg-surface-2 ${dock ? 'h-[54px] w-[72px]' : 'h-16 w-[88px]'} ${item.unlocked ? '' : 'opacity-60 grayscale'}`} />
          <span className="min-w-0">
            <span className="t-subhead flex items-center gap-1.5 font-bold text-ink">
              <span className="truncate">{item.name}</span>
              {fresh.has(item.code) && <span className="shrink-0 rounded-full bg-fill-watch px-1.5 text-[9.5px] font-extrabold uppercase leading-4 tracking-wide text-brand">New</span>}
            </span>
            {(!dock || !locked) && <span className={`t-caption block font-medium text-ink-2 ${dock ? 'truncate' : ''}`}>{item.blurb}</span>}
            {locked && (
              <>
                <span className={`t-caption flex items-center gap-1 font-semibold text-ink-2 ${dock ? 'truncate' : 'mt-1'}`}>
                  <Lock size={11} className="shrink-0" aria-hidden="true" /> <span className="truncate">{r.label}</span> · <span className="tabular">{xp(r.progress)}/{xp(r.target)}</span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (100 * r.progress) / r.target)}%` }} />
                </span>
              </>
            )}
          </span>
          <span className={item.equipped ? 'text-accent' : 'text-ink-3'}>{item.equipped ? <Check size={18} strokeWidth={2.6} aria-label="In the room" /> : !item.unlocked ? <Lock size={15} aria-label="Locked" /> : null}</span>
        </button>
      </li>
    );
  };

  if (full) {
    const at = size && layoutOf(size.w, size.h);
    return (
      // The whole page beside the sidebar: out of the page's own margins, as tall as the window.
      <div className="-mx-7 -mb-12 -mt-6 p-2 pl-0">
        <div ref={box} className="relative h-[calc(100dvh-16px)] overflow-hidden rounded-panel border border-line bg-surface-2">
          {at && (
            <>
              <RoomScene equipped={shown} season={season} trophies={trophies} dropped={dropped} pad={at.pad} fill />
              {/* The furnished part of the room, for what stands in it: Mako, and what he says. */}
              <div className="pointer-events-none absolute [&>*]:pointer-events-auto" style={at.stage}>
                {makoButton}
                {bubble}
              </div>
            </>
          )}
          <header className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3 [&>*]:pointer-events-auto">
            <div className="room-glass flex h-12 min-w-0 items-center gap-2.5 rounded-control border border-line pl-1.5 pr-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
                <Armchair size={19} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <h1 className="truncate text-[19px] font-semibold leading-6 tracking-[-0.02em] text-title">Mako’s room</h1>
                <p className="t-caption hidden truncate font-medium text-ink-2 xl:block">Earned by learning. Only for show: no score changes.</p>
              </span>
            </div>
            <dl className="flex shrink-0 gap-2">{stats.map((s) => stat(s, true))}</dl>
          </header>
          <div className="pointer-events-none absolute inset-x-0 top-[68px] flex justify-center">{previewTag}</div>

          <aside aria-label="Choose what goes in the room" className="room-glass absolute inset-x-3 bottom-3 flex h-[128px] flex-col gap-2 rounded-panel border border-line p-2.5">
            <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Parts of the room">
              {room.slots.map((s) => tabButton(s, true))}
            </div>
            <ul id="room-items" role="tabpanel" aria-labelledby={`room-tab-${slot.key}`} className="-m-1 flex min-h-0 flex-1 gap-2 overflow-x-auto p-1">
              {slot.items.map((item) => card(item, true))}
            </ul>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <PageHeader icon={Armchair} title="Mako’s room" subtitle="Levels, streaks, words and quests open new things for it. It’s only for show: no score changes." actions={<dl className="flex gap-2">{stats.map((s) => stat(s, false))}</dl>} />
      <section aria-label="The room" className="min-w-0">
        <div className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-[0_24px_60px_-34px_rgba(40,20,70,0.45)]">
          <div className="relative">
            <RoomScene equipped={shown} season={season} trophies={trophies} dropped={dropped} />
            {makoButton}
            <div className="absolute left-3 top-3 max-w-[calc(100%-24px)]">{previewTag}</div>
          </div>
          {bubble}
        </div>
        <p className="t-footnote mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-ink-2">
          <Trophy size={14} className="text-fill-watch" aria-hidden="true" />
          {earned.length === 0 ? 'The shelves are empty: every achievement you earn stands on them.' : `On the shelves: ${earned.length > SHELF_ROOM ? `your latest ${SHELF_ROOM} achievements` : earned.length === 1 ? 'your first achievement' : `your ${earned.length} achievements`}.`}
          <Link to="/progress" className="font-semibold text-accent hover:underline">
            See them all
          </Link>
        </p>
      </section>
      <aside aria-label="Choose what goes in the room" className="mt-4 rounded-panel border border-line bg-surface p-3">
        <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Parts of the room">
          {room.slots.map((s) => tabButton(s, false))}
        </div>
        <ul id="room-items" role="tabpanel" aria-labelledby={`room-tab-${slot.key}`} className="mt-3 flex flex-col gap-2">
          {slot.items.map((item) => card(item, false))}
        </ul>
        <p className="t-caption mt-3 px-1 font-medium text-ink-3">Press a locked one to see it in the room for a moment.</p>
      </aside>
    </div>
  );
}
