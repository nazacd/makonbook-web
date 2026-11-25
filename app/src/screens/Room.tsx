import { Armchair, Check, Flower2, Grid3x3, Image, LampDesk, Lightbulb, Lock, Palette, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useGamification, xp } from '@/api/gamification';
import { equippedOf, newItems, useEquip, useRoom, useSeenRoom, type Room as RoomData, type RoomItem } from '@/api/room';
import { iconOf } from '@/components/achievements/catalogue';
import { Panda, type PandaHandle } from '@/components/mascot/Panda';
import { RoomDefs, type RoomSlot } from '@/components/room/items';
import { RoomScene, RoomThumb, SHELF_ROOM, type Trophy as ShelfTrophy } from '@/components/room/Scene';
import { ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/ui';
import { LINES, say } from '@/lib/mako';
import { burstFrom, useSeason } from '@/lib/season';
import { useTitle } from '@/lib/title';

// "/room": Mako's room (spec 28). The room on one side, drawn with what is
// placed in it and with Mako on the rug; on the other a picker, a tab per
// slot. Pressing an unlocked item places it at once (saved to the server,
// put back if that fails); pressing a locked one shows it in the room for a
// moment, with what it takes. Mako says what is nearest to opening, and
// reacts to what is done. Everything is for show: nothing changes a score.

const SLOT_ICON: Record<RoomSlot, LucideIcon> = { wallpaper: Palette, art: Image, rug: Grid3x3, desk: LampDesk, corner: Lightbulb, plant: Flower2 };
const PREVIEW_MS = 2800;
const LINE_MS = 3600;

export function Room() {
  useTitle('Mako’s room');
  const room = useRoom();
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <RoomDefs />
      {room.isPending ? (
        <>
          <PageHeader icon={Armchair} title="Mako’s room" />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton height={420} radius={20} />
            <Skeleton height={420} radius={20} />
          </div>
        </>
      ) : room.isError || !room.data ? (
        <>
          <PageHeader icon={Armchair} title="Mako’s room" />
          <ErrorState title="The room didn’t load" message={describeError(room.error)} onRetry={() => void room.refetch()} retrying={room.isFetching} />
        </>
      ) : (
        <Loaded room={room.data} />
      )}
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
  const panda = useRef<PandaHandle>(null);
  const mako = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<RoomSlot>(() => (newItems(room)[0] ? room.slots.find((s) => s.items.some((i) => i.is_new))!.key : 'wallpaper'));
  // The items that were new when the page opened: tagged until it is left.
  const [fresh] = useState(() => new Set(newItems(room).map((i) => i.code)));
  const [preview, setPreview] = useState<{ slot: RoomSlot; item: RoomItem } | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [shaken, setShaken] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const previewTimer = useRef(0);
  const lineTimer = useRef(0);

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

  const stats: [string, string, string?][] = [
    ['Level', String(room.level)],
    ['Items', String(room.items_unlocked), `/${room.items_total}`],
    ...(g ? ([['Trophies', String(earned.length), `/${g.achievements.length}`]] as [string, string, string][]) : []),
  ];

  return (
    <>
      <PageHeader
        icon={Armchair}
        title="Mako’s room"
        subtitle="Levels, streaks, words and quests open new things for it. It’s only for show: no score changes."
        actions={
          <dl className="flex gap-2">
            {stats.map(([label, value, of]) => (
              <div key={label} className="min-w-[76px] rounded-control border border-line bg-surface px-3 py-2">
                <dt className="t-micro text-ink-3">{label}</dt>
                <dd className="t-number text-[20px] leading-6 text-ink">
                  {value}
                  {of && <span className="text-[13px] font-semibold text-ink-3">{of}</span>}
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="The room" className="min-w-0">
          <div className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-[0_24px_60px_-34px_rgba(40,20,70,0.45)]">
            <div className="relative">
              <RoomScene equipped={shown} season={season} trophies={trophies} dropped={dropped} />
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
              {preview && (
                <p className="pop absolute left-3 top-3 flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-[12px] font-semibold text-paper backdrop-blur-sm" role="status">
                  <Lock size={12} aria-hidden="true" /> A look at {preview.item.name}
                </p>
              )}
            </div>
            <p className="room-say" aria-live="polite">
              <span className="mk-say-name">Mako</span>
              <span className="t-footnote font-semibold text-ink">{line ?? (fresh.size > 0 ? welcome(room, fresh) : hint(room))}</span>
            </p>
          </div>
          <p className="t-footnote mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-ink-2">
            <Trophy size={14} className="text-fill-watch" aria-hidden="true" />
            {earned.length === 0 ? 'The shelves are empty: every achievement you earn stands on them.' : `On the shelves: ${earned.length > SHELF_ROOM ? `your latest ${SHELF_ROOM} achievements` : earned.length === 1 ? 'your first achievement' : `your ${earned.length} achievements`}.`}
            <Link to="/progress" className="font-semibold text-accent hover:underline">
              See them all
            </Link>
          </p>
        </section>

        <aside aria-label="Choose what goes in the room" className="rounded-panel border border-line bg-surface p-3 lg:sticky lg:top-4">
          <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Parts of the room">
            {room.slots.map((s) => {
              const I = SLOT_ICON[s.key];
              const on = s.key === slot.key;
              const hasNew = s.items.some((i) => fresh.has(i.code));
              return (
                <button key={s.key} type="button" role="tab" id={`room-tab-${s.key}`} aria-selected={on} aria-controls="room-items" onClick={() => setTab(s.key)} className={`relative flex flex-col items-center gap-0.5 rounded-control border px-1 py-2 transition-colors ${on ? 'border-primary bg-accent-tint text-accent' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'}`}>
                  <I size={17} aria-hidden="true" />
                  <span className="text-[11.5px] font-bold leading-4">{s.label}</span>
                  <span className="tabular text-[10.5px] font-semibold leading-3 opacity-80">
                    {s.items.filter((i) => i.unlocked).length}/{s.items.length}
                  </span>
                  {hasNew && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-fill-watch" aria-label="Something new" />}
                </button>
              );
            })}
          </div>
          <ul id="room-items" role="tabpanel" aria-labelledby={`room-tab-${slot.key}`} className="mt-3 flex flex-col gap-2">
            {slot.items.map((item) => {
              const r = item.requirement;
              return (
                <li key={item.code}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    onAnimationEnd={() => setShaken(null)}
                    aria-pressed={item.equipped}
                    className={`lift grid w-full grid-cols-[88px_minmax(0,1fr)_20px] items-center gap-2.5 rounded-control border p-2 text-left ${item.equipped ? 'border-primary shadow-[0_0_0_3px_var(--color-accent-tint)]' : 'border-line'} ${shaken === item.code ? 'room-shake' : ''}`}>
                    <RoomThumb slot={slot.key} code={item.code} className={`h-16 w-[88px] rounded-[10px] bg-surface-2 ${item.unlocked ? '' : 'opacity-45 grayscale'}`} />
                    <span className="min-w-0">
                      <span className="t-subhead flex items-center gap-1.5 font-bold text-ink">
                        <span className="truncate">{item.name}</span>
                        {fresh.has(item.code) && <span className="shrink-0 rounded-full bg-fill-watch px-1.5 text-[9.5px] font-extrabold uppercase leading-4 tracking-wide text-brand">New</span>}
                      </span>
                      <span className="t-caption block font-medium text-ink-2">{item.blurb}</span>
                      {!item.unlocked && r && (
                        <>
                          <span className="t-caption mt-1 flex items-center gap-1 font-semibold text-ink-2">
                            <Lock size={11} aria-hidden="true" /> {r.label} · <span className="tabular">{xp(r.progress)}/{xp(r.target)}</span>
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
            })}
          </ul>
          <p className="t-caption mt-3 px-1 font-medium text-ink-3">Press a locked one to see it in the room for a moment.</p>
        </aside>
      </div>
    </>
  );
}
