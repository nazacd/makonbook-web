import { ArrowDown, ArrowLeft, ArrowRight, Check, Flag as FlagIcon, Lock, Target } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useGoals } from '@/api/learning';
import { useRoadmap, type Roadmap, type RoadmapUnit } from '@/api/roadmaps';
import { Notice } from '@/components/Notice';
import { LockedModal } from '@/components/shell/LockedModal';
import { Skeleton } from '@/components/States';
import { useTitle } from '@/lib/title';

import { Flag } from './flags';
import { GOAL, GROUND, REGION_COLORS, initials, layout, logoOf, pathBetween, segment, type Region, type Stop } from './journey';

// "/roadmaps/:id": the journey. A dark night map scrolled bottom to top: the
// start, each country's stops (a university each, a unit of the course)
// along a glowing path, a border wall into every next country, the goal at
// the top. Done stops are gold, the current one glows, later ones are locked.
// Free accounts see the countries after the first behind a closed gate.

export function RoadmapMap() {
  const { id = '' } = useParams();
  const roadmap = useRoadmap(id);
  useTitle(roadmap.data?.title ?? 'Roadmap');
  if (roadmap.isPending) return <Skeleton height={640} radius={20} />;
  if (roadmap.isError) return <Notice tone="error" message={describeError(roadmap.error)} />;
  return <Journey r={roadmap.data} />;
}

function Journey({ r }: { r: Roadmap }) {
  const navigate = useNavigate();
  const goals = useGoals(r.subject !== undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState({ top: 0, height: 0 });
  const [locked, setLocked] = useState(false);

  // The canvas follows the panel's width.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { height, regions, stops } = useMemo(() => layout(r, Math.max(width, 320)), [r, width]);
  const current = stops.find((s) => s.unit.id === r.current?.unit_id) ?? null;
  const lastDone = [...stops].reverse().find((s) => s.unit.status === 'done') ?? null;
  // Where the glow ends: the current stop, else the last one done.
  const reached = current ?? lastDone;

  // Open on the current stop (the start when nothing's begun).
  const opened = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !width || opened.current) return;
    opened.current = true;
    el.scrollTop = (reached ? reached.y : height) - el.clientHeight * 0.6;
  }, [width, height, reached]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const on = () => setView({ top: el.scrollTop, height: el.clientHeight });
    on();
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);

  // The country in the middle of the view, for the header.
  const mid = view.top + view.height / 2;
  const here = regions.find((g) => mid >= g.top && mid < g.bottom) ?? (mid >= (regions[0]?.bottom ?? 0) ? regions[0] : regions[regions.length - 1]);
  const currentVisible = current ? current.y > view.top + 40 && current.y < view.top + view.height - 120 : true;
  const pct = r.lessons_total ? Math.round((100 * r.lessons_done) / r.lessons_total) : 0;
  const target = goals.data?.target_total ?? null;

  const open = (s: Stop) => {
    if (s.unit.lock === 'enrolled_only') setLocked(true);
    else if (s.unit.status !== 'locked') void navigate(`/roadmaps/${r.id}/units/${s.unit.id}`);
  };
  const toCurrent = () => scroller.current?.scrollTo({ top: (current?.y ?? height) - (scroller.current?.clientHeight ?? 0) * 0.6, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <div className="relative -mx-4 -mt-4 overflow-hidden bg-[#0d1b33] md:mx-0 md:mt-0 md:rounded-panel">
      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent px-3 pb-6 pt-3 md:px-5">
        <div className="flex items-center gap-3">
          <Link to="/roadmaps" aria-label="Back to roadmaps" className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
            <ArrowLeft size={19} />
          </Link>
          <Flag code={here?.code ?? null} size={30} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold leading-5 text-white">
              {r.title}
              {r.group_name && <span className="ml-2 hidden rounded-full bg-white/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-white/85 sm:inline">{r.group_name}</span>}
            </p>
            <p className="truncate text-[12.5px] text-white/70">{here?.name ?? ''}</p>
          </div>
          <span className="ml-auto shrink-0 text-[12.5px] font-semibold text-white/80">
            {r.lessons_done}/{r.lessons_total} lessons
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
          <div className="h-full rounded-full bg-[#f6c343]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div ref={scroller} data-journey className="no-scrollbar relative h-[calc(100dvh-129px-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain md:h-[calc(100dvh-16px)]" tabIndex={-1}>
        {width > 0 && (
          <div className="relative" style={{ height }}>
            {/* Countries, each its own colour, with its name faint and huge */}
            {regions.map((g) => (
              <RegionBand key={g.country} g={g} first={g.country === 0} />
            ))}
            <Goal top={0} target={target} title={r.title} done={!r.current && r.lessons_done === r.lessons_total} />
            <Ground top={height - GROUND} name={regions[0]?.name ?? ''} code={regions[0]?.code ?? null} />

            {/* The path */}
            <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* From the start to the first stop */}
              {stops[0] && <path d={segment({ x: stops[0].x, y: height - 30 }, stops[0])} fill="none" stroke="#7dd3fc" strokeOpacity={0.85} strokeWidth={4} filter="url(#glow)" />}
              {stops.slice(1).map((s, k) => {
                const a = stops[k]!;
                const lit = reached != null && s.index <= reached.index;
                return (
                  <g key={s.unit.id}>
                    <path d={pathBetween(a, s, regions, width)} fill="none" stroke={lit ? '#f6c343' : 'rgba(255,255,255,0.14)'} strokeWidth={lit ? 10 : 9} strokeLinecap="round" strokeLinejoin="round" filter={lit ? 'url(#glow)' : undefined} />
                    <path d={pathBetween(a, s, regions, width)} fill="none" stroke={lit ? '#fff7d6' : 'rgba(255,255,255,0.55)'} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
                  </g>
                );
              })}
              {stops.length > 0 && <path d={segment(stops[stops.length - 1]!, { x: width / 2, y: GOAL * 0.55 })} fill="none" stroke="rgba(246,195,67,0.35)" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />}
            </svg>

            {stops.map((s) => (
              <StopNode key={s.unit.id} s={s} current={s === current} onOpen={() => open(s)} />
            ))}
          </div>
        )}
      </div>

      {/* Continue, and back to the current stop */}
      {r.current && current && (
        <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-3">
          {!currentVisible && (
            <button type="button" onClick={toCurrent} className="flex items-center gap-1.5 self-end rounded-full border border-[#f6c343]/50 bg-black/70 px-3 py-1.5 text-[12.5px] font-bold text-[#f6c343] backdrop-blur md:mr-2">
              <ArrowDown size={14} aria-hidden="true" /> Current stop
            </button>
          )}
          <div className="flex w-full max-w-[460px] items-center gap-3 rounded-[18px] border border-white/10 bg-[#0b1426]/90 p-2.5 pl-3 shadow-2xl backdrop-blur">
            <Medallion name={current.unit.stop.university} size={42} state="open" country={current.country} logo={logoOf(current.unit.stop)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-white">{r.current.unit_title}</p>
              <p className="truncate text-[12px] text-white/65">{r.current.university}</p>
            </div>
            <Link to={`/roadmaps/${r.id}/lessons/${r.current.lesson_id}`} className="lift flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#f6c343] px-4 text-[14px] font-bold text-[#1a1300] hover:bg-[#ffd25e]">
              Continue <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {locked && (
        <LockedModal
          title="The rest of the journey is locked"
          message="Free accounts travel through the first country. Enrol at SATMAKON to continue the journey, with every lesson, level check and homework."
          onClose={() => setLocked(false)}
        />
      )}
    </div>
  );
}

function RegionBand({ g, first }: { g: Region; first: boolean }) {
  const color = REGION_COLORS[g.country % REGION_COLORS.length]!;
  return (
    <div className="absolute inset-x-0" style={{ top: g.top, height: g.bottom - g.top, background: `linear-gradient(180deg, ${color} 0%, ${shade(color)} 100%)` }}>
      {/* A faint grid, like a map */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[clamp(44px,11vw,120px)] font-black uppercase leading-none tracking-[-0.02em] text-white/[0.05]" aria-hidden="true">
        {g.name}
      </p>
      {!first && <Wall g={g} />}
    </div>
  );
}

/** The border into this country: a castle wall with a gate and the country's name. */
function Wall({ g }: { g: Region }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[150px]" aria-label={`Border: ${g.name}${g.locked ? ' (locked)' : ''}`} role="img">
      <div className="absolute inset-x-0 bottom-0 h-[84px] bg-[#a9aec3]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.12) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,.12) 2px, transparent 2px)', backgroundSize: '38px 21px' }} />
      {/* Battlements */}
      <div className="absolute inset-x-0 bottom-[84px] h-[18px]" style={{ background: 'repeating-linear-gradient(90deg, #b9bed2 0 26px, transparent 26px 44px)' }} />
      {/* Towers with flags */}
      {['left-2 md:left-4', 'right-2 md:right-4'].map((side) => (
        <div key={side} className={`absolute bottom-0 ${side} w-[46px]`}>
          <div className="absolute -top-[46px] left-1/2 h-[46px] w-0.5 bg-white/70" />
          <div className="absolute -top-[46px] left-1/2 ml-0.5 overflow-hidden rounded-[2px]">
            <Flag code={g.code} size={20} className="!rounded-[2px] !ring-0" />
          </div>
          <div className="h-[140px] rounded-t-[4px] bg-[#8d93ab]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.14) 2px, transparent 2px)', backgroundSize: '100% 21px' }}>
            <div className="mx-auto mt-6 h-5 w-2 rounded-full bg-black/45" />
          </div>
        </div>
      ))}
      {/* The gate */}
      <div className={`absolute bottom-0 left-1/2 flex h-[70px] w-[64px] -translate-x-1/2 items-center justify-center rounded-t-full border-4 border-[#7b8199] ${g.locked ? 'bg-[#3a2a1a]' : 'bg-[#6b4423]'}`}>
        {g.locked && <Lock size={20} className="text-[#f6c343]" aria-hidden="true" />}
      </div>
      <div className="absolute bottom-[118px] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-[#0b1426]/85 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur">
        <Flag code={g.code} size={22} />
        <span className="whitespace-nowrap text-[13.5px] font-bold text-white">{g.name}</span>
        {g.locked && <Lock size={13} className="text-[#f6c343]" aria-label="locked" />}
      </div>
    </div>
  );
}

function Ground({ top, name, code }: { top: number; name: string; code: string | null }) {
  return (
    <div className="absolute inset-x-0" style={{ top, height: GROUND }}>
      <svg className="absolute inset-x-0 bottom-0" width="100%" height="110" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C 80 10, 150 50, 220 30 S 340 10, 400 32 L 400 110 L 0 110 Z" fill="#7a4e2a" />
        <path d="M0 62 C 90 38, 170 70, 250 52 S 360 40, 400 56 L 400 110 L 0 110 Z" fill="#5f3b1f" />
      </svg>
      <div className="absolute bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-[#0b1426]/85 py-1.5 pl-1.5 pr-3.5 backdrop-blur">
        <Flag code={code} size={22} />
        <span className="whitespace-nowrap text-[13px] font-bold text-white">Start: {name}</span>
      </div>
    </div>
  );
}

function Goal({ top, target, title, done }: { top: number; target: number | null; title: string; done: boolean }) {
  return (
    <div className="absolute inset-x-0 flex flex-col items-center justify-end bg-gradient-to-b from-[#3a2a07] to-transparent" style={{ top, height: GOAL }}>
      <div className="mb-6 flex flex-col items-center">
        <span className={`flex size-[86px] items-center justify-center rounded-full border-4 border-[#ffe08a] bg-gradient-to-br from-[#ffd85e] to-[#c8901a] text-[#3a2600] shadow-[0_0_40px_rgba(246,195,67,0.55)] ${done ? '' : 'opacity-90'}`}>
          {done ? <FlagIcon size={34} aria-hidden="true" /> : <Target size={36} aria-hidden="true" />}
        </span>
        <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f6c343]">{done ? 'Journey complete' : 'Your goal'}</p>
        <p className="text-[15px] font-bold text-white">{target ? `${target} on the SAT` : title}</p>
      </div>
    </div>
  );
}

function StopNode({ s, current, onOpen }: { s: Stop; current: boolean; onOpen: () => void }) {
  const u: RoadmapUnit = s.unit;
  const state = u.status === 'done' ? 'done' : u.status === 'open' ? 'open' : 'locked';
  const lessonsDone = u.lessons.filter((l) => l.status === 'done').length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center outline-offset-4"
      style={{ left: s.x, top: s.y }}
      aria-label={`Stop ${s.index + 1}: ${u.title}, ${u.stop.university}. ${state === 'done' ? 'Done' : state === 'open' ? `${lessonsDone} of ${u.lessons.length} lessons done` : u.lock === 'enrolled_only' ? 'For SATMAKON students' : 'Locked'}`}>
      <span className="relative">
        {current && <span className="absolute -inset-2 animate-ping rounded-full bg-[#f6c343]/25 motion-reduce:animate-none" aria-hidden="true" />}
        <Medallion name={u.stop.university} size={74} state={state} country={s.country} current={current} logo={logoOf(u.stop)} />
        <span className={`absolute -bottom-0.5 -left-0.5 flex size-6 items-center justify-center rounded-full border-2 border-[#0d1b33] text-[11px] font-bold ${state === 'locked' ? 'bg-[#4b5468] text-white/80' : 'bg-[#f6c343] text-[#1a1300]'}`}>{s.index + 1}</span>
        {state === 'done' && (
          <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full border-2 border-[#0d1b33] bg-[#22c55e] text-white">
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {state === 'locked' && (
          <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full border-2 border-[#0d1b33] bg-[#4b5468] text-white/85">
            <Lock size={11} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className={`mt-2 w-max max-w-[170px] rounded-[10px] border px-3 py-1.5 text-center shadow-lg backdrop-blur transition-colors ${state === 'locked' ? 'border-white/10 bg-[#0b1426]/70' : 'border-white/15 bg-[#0b1426]/90 group-hover:border-[#f6c343]/60'}`}>
        <span className={`block text-[13px] font-bold leading-4 ${state === 'locked' ? 'text-white/60' : 'text-white'}`}>{u.title}</span>
        <span className={`mt-0.5 block text-[11px] leading-[14px] ${state === 'locked' ? 'text-white/40' : 'text-white/70'}`}>{u.stop.university}</span>
      </span>
    </button>
  );
}

const MEDAL = ['#2b5ea7', '#5b3fb8', '#9b2f5f', '#1f7a6e', '#8a6d1a', '#3f7a2e'];

/**
 * A university's medallion: its logo on a white coin (used with the
 * universities' permission; the files live on the server, never in the
 * repo), or its letters when there's no logo.
 */
export function Medallion({ name, size, state, country, current = false, logo = null }: { name: string; size: number; state: 'done' | 'open' | 'locked'; country: number; current?: boolean; logo?: string | null }) {
  const letters = initials(name);
  const base = MEDAL[country % MEDAL.length]!;
  const ring = state === 'done' ? '#f6c343' : state === 'open' ? '#ffffff' : '#5b6478';
  const glow = `0 0 0 ${Math.max(3, size / 18)}px ${ring}${current ? ', 0 0 28px rgba(246,195,67,0.7)' : state === 'done' ? ', 0 0 18px rgba(246,195,67,0.45)' : ''}`;
  if (logo)
    return (
      <span className="relative flex items-center justify-center overflow-hidden rounded-full bg-white" style={{ width: size, height: size, boxShadow: glow }} aria-hidden="true">
        <img src={logo} alt="" draggable={false} className={`h-[78%] w-[78%] object-contain ${state === 'locked' ? 'opacity-55 grayscale' : ''}`} />
      </span>
    );
  return (
    <span
      className="relative flex items-center justify-center rounded-full font-black tracking-[-0.02em]"
      style={{
        width: size,
        height: size,
        background: state === 'locked' ? 'radial-gradient(circle at 35% 30%, #6b7489, #3c4456)' : `radial-gradient(circle at 35% 30%, ${lighten(base)}, ${base})`,
        boxShadow: glow,
        color: state === 'locked' ? 'rgba(255,255,255,0.55)' : '#ffffff',
        fontSize: size * (letters.length > 3 ? 0.24 : 0.3),
      }}
      aria-hidden="true">
      <span className="absolute inset-[9%] rounded-full border border-dashed border-white/35" />
      {letters}
    </span>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
