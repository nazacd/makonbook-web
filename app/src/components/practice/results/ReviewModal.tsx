import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { RichContent } from '@/components/practice/RichContent';
import { useDialog } from '@/lib/dialog';
import type { StoredPackage } from '@/lib/practice/local';

import { REF, SECTION_LABEL } from './format';
import { acceptedLine, type ResultRow } from './model';
import { Complexity, Mark, type Stats } from './ResultTable';

// One question of a finished attempt, in a large modal over the results (the
// design reference's review): the question as it was, the choices coloured
// (your wrong one red with a ✗, the right one green), what you answered, and
// the answer section with the explanation. Previous / Next walk the table's
// questions; the answer and explanation can be hidden to have another go.

const LETTERS = ['A', 'B', 'C', 'D'] as const;

// Display formulas in an explanation sit in light blocks with a blue rule, as the reference's steps do.
const EXPLANATION =
  'rich rich-sm [&_.mjx-display]:block [&_.mjx-display]:rounded-[6px] [&_.mjx-display]:border-l-[3px] [&_.mjx-display]:border-[#3b82f6] [&_.mjx-display]:bg-surface-2 [&_.mjx-display]:px-4 [&_.mjx-display]:py-4';

type Props = {
  title: string;
  items: ResultRow[];
  index: number;
  stored: StoredPackage;
  stats: Stats;
  hidden: boolean;
  onHidden: (hidden: boolean) => void;
  onGo: (index: number) => void;
  onClose: () => void;
};

export function ReviewModal({ title, items, index, stored, stats, hidden, onHidden, onGo, onClose }: Props) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const titleId = useId();
  const row = items[index]!;
  const { q } = row;
  const images = stored.package.images;
  const links = stored.images;
  const first = index === 0;
  const last = index === items.length - 1;

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  // ← and → walk the questions, unless typing.
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]') && !(t instanceof HTMLInputElement && t.type === 'checkbox')) return;
    if (e.key === 'ArrowRight' && !last) onGo(index + 1);
    else if (e.key === 'ArrowLeft' && !first) onGo(index - 1);
    else return;
    e.preventDefault();
  };

  const question = (
    <div className="flex flex-col gap-3">
      <RichContent text={q.stem} images={images} links={links} className="rich rich-sm" />
      {q.choices ? (
        <ul className="flex flex-col items-start gap-2" aria-label="Choices">
          {LETTERS.filter((l) => q.choices![l] != null).map((l) => {
            const correct = !hidden && l === q.correct;
            const wrong = !hidden && l === row.given && !correct;
            const fill = correct ? REF.green : wrong ? REF.red : undefined;
            return (
              <li key={l} className="flex max-w-full items-center gap-1.5" aria-label={`Choice ${l}${correct ? ', the correct answer' : ''}${wrong ? ', your answer, wrong' : ''}${!hidden && l === row.given && correct ? ', your answer' : ''}`}>
                <span className={`flex min-w-0 items-baseline gap-1 rounded-[6px] border px-2 py-[3px] text-[14px] ${fill ? 'border-transparent text-white' : 'border-line-strong text-ink'}`} style={fill ? { background: fill } : undefined}>
                  <span className="shrink-0 font-semibold">{l}.</span>
                  <RichContent text={q.choices![l]} images={images} links={links} displayMath className={`rich min-w-0 text-[14px] leading-[1.45] ${fill ? 'text-white' : ''}`} />
                </span>
                {wrong && <Mark right={false} />}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-[14px] text-ink-2">
        Attempted answers:{' '}
        {row.given ? (
          <span className="font-semibold" style={hidden ? undefined : { color: row.outcome === 'correct' ? REF.green : REF.redText }}>
            {row.given}
          </span>
        ) : (
          <span className="text-ink-3">-</span>
        )}
      </p>
      {hidden ? (
        <div className="rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center">
          <p className="text-[15px] font-semibold text-ink">The answer and explanation are hidden</p>
          <p className="t-footnote mt-1 text-ink-2">Have another go first, then turn them back on below.</p>
        </div>
      ) : (
        <AnswerSection key={row.slot}>
          <h3 className="text-[22px] font-bold leading-7 text-ink">Answer section:</h3>
          <p className="mt-3 text-[15px] text-ink">
            The correct answer is <span className="font-semibold text-info">{acceptedLine(q)}</span>.
          </p>
          {q.explanation && (
            <>
              <h3 className="mt-6 text-[22px] font-bold leading-7 text-ink">Explanation section:</h3>
              <RichContent text={q.explanation} images={images} links={links} className={`${EXPLANATION} mt-3`} />
            </>
          )}
        </AnswerSection>
      )}
    </div>
  );

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[8px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKey}
        onClick={(e) => e.stopPropagation()}
        className="pop flex h-[calc(100dvh-10px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-t-panel bg-surface outline-none sm:h-[min(900px,calc(100dvh-48px))] sm:rounded-[14px]">
        <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[22px] font-medium leading-7 text-title sm:text-[24px] sm:leading-8">
              {title}
            </h2>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag>{SECTION_LABEL[row.subject]}</Tag>
              <Tag>Module {row.module}</Tag>
              {q.skill && <Tag>{q.skill}</Tag>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the review" className="-mr-1.5 -mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-chip text-title hover:bg-surface-2">
            <X size={19} strokeWidth={2} />
          </button>
        </header>

        <div key={row.slot} className={`min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-5 ${q.passage ? 'lg:grid lg:grid-cols-2 lg:gap-0 lg:overflow-hidden lg:p-0' : ''}`}>
          {q.passage && (
            <div className="mb-5 lg:mb-0 lg:overflow-y-auto lg:border-r lg:border-line lg:px-5 lg:pb-6">
              <QuestionBar row={row} stats={stats} hidden={hidden} />
              <div className="mt-3">
                <RichContent text={q.passage} images={images} links={links} className="rich rich-sm" />
              </div>
            </div>
          )}
          <div className={q.passage ? 'lg:overflow-y-auto lg:px-5 lg:pb-6 lg:pt-[44px]' : 'max-w-[860px]'}>
            {!q.passage && (
              <div className="mb-3">
                <QuestionBar row={row} stats={stats} hidden={hidden} />
              </div>
            )}
            {question}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-line px-4 py-3 sm:px-5">
          <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => onHidden(e.target.checked)}
              className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-2 bg-surface transition-[border] duration-150 checked:border-[5px] checked:border-primary"
            />
            Hide correct answer and explanation
          </label>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="t-footnote tabular text-ink-3" aria-live="polite">
              {index + 1} of {items.length}
            </span>
            <button type="button" onClick={() => onGo(index - 1)} disabled={first} className="h-8 rounded-[8px] border border-line-strong bg-surface px-5 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-surface-2 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface">
              Previous
            </button>
            <button type="button" onClick={last ? onClose : () => onGo(index + 1)} className="lift h-8 rounded-[8px] bg-primary px-5 text-[13px] font-medium text-on-primary hover:bg-primary-hover">
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-[6px] border border-line px-2 text-[12px] font-medium text-ink-2">{children}</span>;
}

/** "Question: 3", and quietly how it went: time and complexity. */
function QuestionBar({ row, stats, hidden }: { row: ResultRow; stats: Stats; hidden: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex h-7 items-center rounded-[6px] px-2.5 text-[13px] font-semibold text-white" style={{ background: REF.omitted }}>
        Question: {row.position}
      </span>
      {!hidden && row.outcome === 'skipped' && <span className="text-[13px] font-semibold text-ink-2">Omitted</span>}
      <span className="text-[13px] text-ink-3">
        <Complexity row={row} stats={stats} />
      </span>
    </div>
  );
}

/** The answer section: folded to its first lines when it runs long, with "Show More" to open it. */
function AnswerSection({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > 300);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <section className="mt-1 overflow-hidden rounded-[10px] border border-line" aria-label="Answer and explanation">
      <div className={`relative ${!open && long ? 'max-h-[280px] overflow-hidden' : ''}`}>
        <div ref={inner} className="px-4 py-5 sm:px-6">
          {children}
        </div>
        {!open && long && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-9 w-full items-center justify-center gap-1 border-t border-line text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          {open ? 'Show Less' : 'Show More'}
        </button>
      )}
    </section>
  );
}
