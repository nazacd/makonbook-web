import { History, Lock, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Skeleton } from '@/components/States';
import { formatDay, formatStamp, minutesShort, REF, SECTION_LABEL } from '@/components/practice/results/format';
import type { LocalAttempt, Run } from '@/lib/practice/local';
import type { CatalogTest } from '@/lib/practice/types';

import type { ModuleRow, ModuleStatus } from './modules';

// A mock test as a card in the list, as the design reference draws its
// assessment cards: the title centred, two tiles, the modules in an inset
// panel that scrolls on its own, and the action across the bottom. A test not
// open yet is the same card, dimmed, with how far its questions are checked.

const testPath = (code: string) => `/practice/test/${encodeURIComponent(code)}`;

const PRIMARY = 'lift flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover';
const OUTLINE = 'flex h-10 w-full items-center justify-center gap-2 rounded-control border border-accent bg-surface px-4 text-[14px] font-bold text-accent transition-colors duration-150 hover:bg-accent-tint';

function Frame({ label, index, top, children }: { label: string; index: number; top?: ReactNode; children: ReactNode }) {
  return (
    <article aria-label={label} className="rise flex flex-col gap-3 rounded-card border border-line bg-surface p-[18px]" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      {top && <div className="-mb-1.5 flex h-5 items-center justify-between gap-2">{top}</div>}
      {children}
    </article>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-center">
      <h2 className="line-clamp-2 text-center text-[16px] font-bold leading-[22px] text-ink">{children}</h2>
    </div>
  );
}

/** A solid pill: white 12px/600 on a status colour. */
export function SolidPill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-[21px] w-fit shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

type Tile = { key: string; top: ReactNode; bottom: ReactNode };

function Tiles({ tiles }: { tiles: [Tile, Tile] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((t) => (
        <div key={t.key} className="flex h-[70px] min-w-0 flex-col justify-between rounded-control border border-line bg-surface-2 px-[13px] py-[11px]">
          {t.top}
          {t.bottom}
        </div>
      ))}
    </div>
  );
}

const label = (text: string) => <span className="truncate text-[13px] font-medium leading-4 text-ink-2">{text}</span>;
const number = (value: ReactNode, of?: string) => (
  <span className="truncate text-[18px] font-bold leading-6 text-ink tabular">
    {value}
    {of && <span className="ml-1 text-[13px] font-semibold text-ink-2">{of}</span>}
  </span>
);

/** The left tile of a test not finished: its date and a pill under it (an assigned test: its deadline). */
const dateTile = (iso: string | null | undefined, due?: string | null): Tile => ({
  key: 'date',
  top: <span className="truncate text-[13px] font-medium leading-4 text-ink">{formatDay(due ?? iso)}</span>,
  bottom: <SolidPill color={REF.deadline}>{due ? 'Deadline' : 'Published'}</SolidPill>,
});
const totalTile = (questions: number): Tile => ({ key: 'total', top: label('Total questions'), bottom: number(questions || '—') });

const STATUS: Record<ModuleStatus, { label: string; color: string }> = {
  planned: { label: 'Planned', color: REF.planned },
  running: { label: 'In progress', color: 'var(--color-primary)' },
  finished: { label: 'Finished', color: REF.finished },
};

/** A thin bar in a colour on a 20 % track of it. */
export function ToneBar({ value, color, className = '' }: { value: number; color: string; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${className}`} style={{ background: `color-mix(in srgb, ${color} 20%, transparent)` }} aria-hidden="true">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

function ModulesPanel({ rows }: { rows: ModuleRow[] }) {
  // More than two rows overflow the panel; then it takes focus, so the keyboard can scroll it.
  const scrolls = rows.length > 2;
  return (
    <div role="region" aria-label="Modules" tabIndex={scrolls ? 0 : undefined} className="h-[182px] overflow-y-auto overscroll-contain rounded-control bg-surface-2 p-2">
      <ul className="flex flex-col gap-2">
        {rows.map((m) => {
          const s = STATUS[m.status];
          const what = m.doneMeans === 'right' ? 'right' : 'answered';
          return (
            <li key={`${m.subject}-${m.module}`} className="rounded-control border border-line bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-ink-2 tabular">{minutesShort(m.minutes)}</span>
                <SolidPill color={s.color}>{s.label}</SolidPill>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-semibold text-ink">
                  {SECTION_LABEL[m.subject]} · Module {m.module}
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-ink tabular" aria-label={`${m.done} of ${m.questions} ${what}`} title={`${m.done} of ${m.questions} ${what}`}>
                  {m.done}/{m.questions}
                </span>
              </div>
              <ToneBar className="mt-2" value={m.questions ? m.done / m.questions : 0} color={s.color} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function NewTestCard({ test, name, rows, index, due }: { test: CatalogTest; name: string; rows: ModuleRow[]; index: number; due?: string | null }) {
  return (
    <Frame label={due ? `${name}, assigned` : name} index={index}>
      <Title>{name}</Title>
      <Tiles tiles={[dateTile(test.published_at, due), totalTile(test.questions)]} />
      <ModulesPanel rows={rows} />
      <Link to={testPath(test.code)} className={PRIMARY} aria-label={`Let’s start ${name}`}>
        Let’s start!
      </Link>
    </Frame>
  );
}

export function RunTestCard({ code, name, run, rows, published, questions, index, onDiscard, due }: { code: string; name: string; run: Run; rows: ModuleRow[]; published: string | null; questions: number; index: number; onDiscard: () => void; due?: string | null }) {
  return (
    <Frame
      label={`${name}, in progress`}
      index={index}
      top={
        <>
          <span className="truncate text-[12px] font-medium text-ink-2 tabular">{formatStamp(run.startedAt)}</span>
          <button
            type="button"
            onClick={onDiscard}
            aria-label={`Discard your progress in ${name}`}
            title="Discard progress"
            className="-mr-1.5 flex size-7 items-center justify-center rounded-chip text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </>
      }>
      <Title>{name}</Title>
      <Tiles tiles={[dateTile(published, due), totalTile(questions)]} />
      <ModulesPanel rows={rows} />
      <Link to={`/practice/run/${encodeURIComponent(code)}`} className={PRIMARY} aria-label={`Continue ${name}`}>
        Continue
      </Link>
    </Frame>
  );
}

export function PassedTestCard({ code, name, latest, attempts, rows, index }: { code: string; name: string; latest: LocalAttempt; attempts: number; rows: ModuleRow[]; index: number }) {
  const full = latest.total != null;
  const only = latest.sections[0]!;
  const score = full ? latest.total : latest.scores[only]?.score;
  const scores = latest.sections.map((s) => latest.scores[s]).filter((s) => s != null);
  const right = scores.reduce((n, s) => n + s.raw, 0);
  const total = scores.reduce((n, s) => n + s.questions, 0);
  return (
    <Frame
      label={`${name}, finished`}
      index={index}
      top={
        <>
          <span className="truncate text-[12px] font-medium text-ink-2 tabular">{formatStamp(latest.finished_at)}</span>
          <Link
            to={`/practice/history/${encodeURIComponent(code)}`}
            aria-label={`History of ${name}, ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`}
            title="History"
            className="-mr-1.5 flex size-7 items-center justify-center rounded-chip text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink">
            <History size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </>
      }>
      <Title>{name}</Title>
      <Tiles
        tiles={[
          { key: 'score', top: label('Final score'), bottom: number(score ?? '—', `of ${full ? 1600 : 800}`) },
          { key: 'result', top: label('Final result'), bottom: number(total ? right : '—', total ? `of ${total}` : undefined) },
        ]}
      />
      <ModulesPanel rows={rows} />
      <div className="grid grid-cols-2 gap-2.5">
        <Link to={`/practice/result/${latest.id}`} className={PRIMARY} aria-label={`See details of ${name}`}>
          See details
        </Link>
        <Link to={testPath(code)} className={OUTLINE} aria-label={`Retake ${name}`}>
          Retake
        </Link>
      </div>
    </Frame>
  );
}

export function LockedTestCard({ test, name, index }: { test: CatalogTest; name: string; index: number }) {
  const checked = test.questions ? Math.min(1, test.approved / test.questions) : 0;
  const students = !!test.enrolled_only;
  return (
    <Frame label={`${name}, ${students ? 'for SATMAKON students' : 'not open yet'}`} index={index}>
      <div className="flex flex-col gap-3 opacity-60 grayscale-[0.5]">
        <Title>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={15} strokeWidth={2.2} aria-hidden="true" className="text-ink-3" />
            {name}
          </span>
        </Title>
        <Tiles
          tiles={[
            { key: 'status', top: <span className="truncate text-[13px] font-medium leading-4 text-ink">{students ? 'SATMAKON students' : 'Not open yet'}</span>, bottom: <SolidPill color={REF.omitted}>Locked</SolidPill> },
            totalTile(test.questions),
          ]}
        />
        <div className="flex h-[182px] flex-col items-center justify-center gap-2 rounded-control bg-surface-2 p-4 text-center">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink-3">
            <Lock size={18} strokeWidth={2} aria-hidden="true" />
          </span>
          {students ? (
            <>
              <p className="text-[14px] font-semibold text-ink">For SATMAKON students</p>
              <p className="t-footnote text-ink-2">Enrol at SATMAKON and every mock test opens for you.</p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-ink tabular">
                {test.approved} of {test.questions} questions checked
              </p>
              <p className="t-footnote text-ink-2">Opens when all are</p>
              <ToneBar className="mt-1 w-40" value={checked} color={REF.finished} />
            </>
          )}
        </div>
      </div>
      <button type="button" disabled className="flex h-10 w-full cursor-default items-center justify-center gap-2 rounded-control bg-surface-2 text-[14px] font-bold text-ink-3">
        <Lock size={15} strokeWidth={2.2} aria-hidden="true" />
        {students ? 'SATMAKON students only' : 'Opens soon'}
      </button>
    </Frame>
  );
}

export function TestCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-[18px]" aria-hidden="true">
      <div className="flex min-h-11 items-center justify-center">
        <Skeleton width="45%" height={18} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton height={70} radius={12} />
        <Skeleton height={70} radius={12} />
      </div>
      <Skeleton height={182} radius={12} />
      <Skeleton height={40} radius={12} />
    </div>
  );
}
