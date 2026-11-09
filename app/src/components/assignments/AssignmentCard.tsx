import { BookOpenCheck, CalendarClock, ClipboardCheck, Lock, RotateCcw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { AssignmentKind, StudentAssignment } from '@/api/assignments';
import { formatStamp, REF, SECTION_LABEL } from '@/components/practice/results/format';
import { SolidPill, ToneBar } from '@/components/practice/cards/TestCard';
import { Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { parseClassName } from '@/lib/groups';
import { testName } from '@/lib/practice/run';

import { dueLong, dueShort, tabOf } from './format';

// An assignment as a card, laid out like the mock-test cards (the design
// reference's assessment cards): the title centred, the deadline and the
// size as two tiles, what it covers in an inset panel, the action at the
// bottom. A finished one shows its first result, which is what the teacher
// sees; trying again is practice.

const PRIMARY = 'lift flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60';
const OUTLINE = 'flex h-10 w-full items-center justify-center gap-2 rounded-control border border-accent bg-surface px-4 text-[14px] font-bold text-accent transition-colors duration-150 hover:bg-accent-tint disabled:opacity-60';

const ICON: Record<AssignmentKind, LucideIcon> = { homework: BookOpenCheck, level_check: ClipboardCheck, exam: CalendarClock };

/** Where an exam starts: the mock test with the assigned sections chosen. */
export const examPath = (a: StudentAssignment) => `/practice/test/${encodeURIComponent(a.test!.code)}?sections=${a.test!.sections.join(',')}`;

function Tile({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return <div className="flex h-[70px] min-w-0 flex-col justify-between rounded-control border border-line bg-surface-2 px-[13px] py-[11px]">{top}{bottom}</div>;
}
const label = (text: string) => <span className="truncate text-[13px] font-medium leading-4 text-ink-2">{text}</span>;
const number = (value: ReactNode, of?: string) => (
  <span className="truncate text-[18px] font-bold leading-6 text-ink tabular">
    {value}
    {of && <span className="ml-1 text-[13px] font-semibold text-ink-2">{of}</span>}
  </span>
);

export function AssignmentCard({ a, index, onStart, starting }: { a: StudentAssignment; index: number; onStart: () => void; starting: boolean }) {
  const tab = tabOf(a);
  const m = a.mine;
  const exam = a.kind === 'exam';
  const closed = a.status === 'closed';
  const now = useNow();
  // Scheduled: shown locked until it opens (the clock opens it here without a refetch).
  const locked = a.status === 'scheduled' && Date.parse(a.opens_at) > now;
  const I = ICON[a.kind];
  const group = parseClassName(a.group_name).title;

  const deadline = (
    <Tile
      top={<span className="truncate text-[13px] font-medium leading-4 text-ink">{dueLong(a.due_at)}</span>}
      bottom={closed ? <SolidPill color={REF.omitted}>Closed</SolidPill> : locked ? <SolidPill color={REF.omitted}>Opens {dueShort(a.opens_at, now)}</SolidPill> : a.status === 'overdue' && tab !== 'passed' ? <SolidPill color={REF.deadline}>Overdue</SolidPill> : <SolidPill color={REF.deadline}>Deadline</SolidPill>}
    />
  );
  const tiles =
    tab === 'passed' ? (
      exam ? (
        <>
          <Tile top={label('Final score')} bottom={number(m.total_score ?? '—', `of ${a.test!.sections.length * 800}`)} />
          <Tile top={label('Tries')} bottom={number(m.tries)} />
        </>
      ) : (
        <>
          <Tile top={label('Final score')} bottom={number(`${m.percent ?? 0}%`)} />
          <Tile top={label('Final result')} bottom={number(m.correct ?? '—', `of ${m.total ?? a.questions}`)} />
        </>
      )
    ) : (
      <>
        {deadline}
        <Tile top={label('Total questions')} bottom={number(a.questions)} />
      </>
    );

  const status: { text: string; color: string } =
    tab === 'passed' ? (m.late ? { text: 'Late', color: REF.deadline } : { text: 'Finished', color: REF.finished }) : tab === 'run' ? { text: 'In progress', color: 'var(--color-primary)' } : locked ? { text: 'Locked', color: REF.omitted } : { text: 'Planned', color: REF.planned };

  return (
    <article aria-label={`${a.title}, ${status.text}`} className="rise flex flex-col gap-3 rounded-card border border-line bg-surface p-[18px]" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="-mb-1.5 flex h-5 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] font-medium text-ink-2">
          <I size={13} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{tab === 'passed' && m.finished_at ? formatStamp(m.finished_at) : group}</span>
        </span>
        {m.tries > 1 && <span className="shrink-0 text-[12px] font-semibold text-ink-3 tabular">best {exam ? m.best : `${m.best}%`}</span>}
      </div>
      <div className="flex min-h-11 items-center justify-center">
        <h2 className="line-clamp-2 text-center text-[16px] font-bold leading-[22px] text-ink">{testName(a.title)}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5">{tiles}</div>

      <div className="flex h-[182px] flex-col gap-2 overflow-y-auto overscroll-contain rounded-control bg-surface-2 p-2">
        {exam ? (
          a.test!.sections.map((s) => (
            <Row key={s} top={`${SECTION_LABEL[s]} · 2 modules`} status={status} title={testName(a.test!.title)} count={`${a.test![s]} q`} value={tab === 'passed' ? 1 : 0} />
          ))
        ) : (
          <Row
            top={a.lesson ? a.lesson.unit_title : a.kind === 'level_check' ? 'Level check' : 'Homework'}
            status={status}
            title={a.lesson ? a.lesson.title : a.subject === 'math' ? 'Math' : 'Reading & Writing'}
            count={tab === 'passed' ? `${m.correct}/${m.total}` : `${a.questions} q`}
            value={tab === 'passed' && m.total ? (m.correct ?? 0) / m.total : 0}
          />
        )}
        {a.instructions && <p className="whitespace-pre-line rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] leading-[18px] text-ink-2">{a.instructions}</p>}
        {a.kind === 'level_check' && tab === 'passed' && (
          <p className={`px-1 text-[12.5px] font-semibold ${m.passed ? 'text-good' : 'text-ink-2'}`}>{m.passed ? 'Passed: the lesson counts on your roadmap.' : '70% passes. Try again for practice.'}</p>
        )}
      </div>

      {locked ? (
        <button type="button" disabled className="flex h-10 w-full cursor-default items-center justify-center gap-2 rounded-control bg-surface-2 text-[14px] font-bold text-ink-2">
          <Lock size={15} aria-hidden="true" /> Opens {dueLong(a.opens_at)}
        </button>
      ) : closed && tab !== 'passed' && m.status !== 'in_progress' ? (
        <button type="button" disabled className="flex h-10 w-full cursor-default items-center justify-center gap-2 rounded-control bg-surface-2 text-[14px] font-bold text-ink-3">
          <Lock size={15} aria-hidden="true" /> Closed by your teacher
        </button>
      ) : tab === 'passed' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Link to={exam ? `/practice/result/${m.attempt_id}` : `/assessments/${m.assessment_id}`} className={PRIMARY}>
            See details
          </Link>
          {exam ? (
            <Link to={examPath(a)} className={OUTLINE}>
              <RotateCcw size={14} aria-hidden="true" /> Retake
            </Link>
          ) : (
            <button type="button" onClick={onStart} disabled={starting || closed} className={OUTLINE}>
              <RotateCcw size={14} aria-hidden="true" /> {starting ? 'Preparing…' : 'Retake'}
            </button>
          )}
        </div>
      ) : exam ? (
        <Link to={examPath(a)} className={PRIMARY}>
          Let’s start!
        </Link>
      ) : (
        <button type="button" onClick={onStart} disabled={starting} className={PRIMARY}>
          {starting ? 'Preparing…' : tab === 'run' ? 'Continue' : 'Let’s start!'}
        </button>
      )}
    </article>
  );
}

function Row({ top, status, title, count, value }: { top: string; status: { text: string; color: string }; title: string; count: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-ink-2">{top}</span>
        <SolidPill color={status.color}>{status.text}</SolidPill>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-semibold text-ink">{title}</span>
        <span className="shrink-0 text-[14px] font-semibold text-ink tabular">{count}</span>
      </div>
      <ToneBar className="mt-2" value={value} color={status.color} />
    </div>
  );
}

export function AssignmentCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-[18px]" aria-hidden="true">
      <div className="flex min-h-11 items-center justify-center">
        <Skeleton width="55%" height={18} />
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
