import { Bookmark, ListChecks, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { useDialog } from '@/lib/dialog';

// The question list over the footer of a set (screens/roadmap/AssessmentRun):
// every question as a numbered cell that says how it stands, in a box that
// scrolls, however long the set is. "Group answered" sorts the cells into
// what is left and what is done. Colour is never the only sign: a blank cell
// is dashed, a wrong one has an edge, the current one a ring.

export type NavState = 'blank' | 'answered' | 'right' | 'wrong';
export type NavItem = { n: number; state: NavState; marked: boolean };

const LOOK: Record<NavState, string> = {
  blank: 'border border-dashed border-line-strong text-ink-2',
  answered: 'bg-accent-tint text-accent',
  right: 'bg-good-tint text-good',
  wrong: 'border border-bad bg-bad-tint text-bad',
};
const WORD: Record<NavState, string> = { blank: 'unanswered', answered: 'answered', right: 'right', wrong: 'wrong' };

export function Navigator({
  items,
  current,
  checked,
  grouped,
  onGrouped,
  onGo,
  onClose,
  footer,
}: {
  items: NavItem[];
  /** The question on screen, from 1. */
  current: number;
  /** Answers are checked one by one (a set at one's own pace): cells say right or wrong. */
  checked: boolean;
  grouped: boolean;
  onGrouped: (on: boolean) => void;
  onGo: (n: number) => void;
  onClose: () => void;
  footer: ReactNode;
}) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  const scroller = useRef<HTMLDivElement>(null);
  // Opens with the current question in view.
  useEffect(() => {
    const box = scroller.current;
    const cell = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (box && cell) box.scrollTop = cell.offsetTop - box.offsetTop - box.clientHeight / 2 + cell.offsetHeight / 2;
  }, [grouped]);

  const done = items.filter((x) => x.state !== 'blank').length;
  const groups: { title: string; list: NavItem[] }[] = !grouped
    ? [{ title: '', list: items }]
    : [
        { title: 'To do', list: items.filter((x) => x.state === 'blank') },
        ...(checked
          ? [
              { title: 'Right', list: items.filter((x) => x.state === 'right') },
              { title: 'Wrong', list: items.filter((x) => x.state === 'wrong') },
            ]
          : []),
        { title: 'Answered', list: items.filter((x) => x.state === 'answered') },
      ].filter((g) => g.list.length > 0);

  return (
    <>
      <div className="fixed inset-0 z-20" aria-hidden="true" onClick={onClose} />
      <div ref={dialog} tabIndex={-1} role="dialog" aria-label="Questions" className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 flex max-h-[min(72dvh,600px)] w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col rounded-panel border border-line bg-paper shadow-[0_16px_48px_-12px_rgba(0,0,0,0.4)] outline-none">
        <span aria-hidden="true" className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-line bg-paper" />
        <div className="flex items-center gap-2 px-4 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="t-headline text-ink">Questions</h2>
            <p className="t-caption font-medium text-ink-2">
              {done} of {items.length} answered
            </p>
          </div>
          <button type="button" onClick={() => onGrouped(!grouped)} aria-pressed={grouped} className={`t-footnote flex h-8 items-center gap-1.5 rounded-full border px-3 font-semibold ${grouped ? 'border-primary bg-accent-tint text-accent' : 'border-line text-ink-2 hover:text-ink'}`}>
            <ListChecks size={14} aria-hidden="true" /> Group answered
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex size-8 items-center justify-center rounded-chip text-ink-2 hover:bg-paper-2 hover:text-ink">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <p className="t-caption flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 pb-3 pt-2.5 font-medium text-ink-2">
          <Key look="ring-2 ring-ink ring-offset-1 ring-offset-paper">Current</Key>
          <Key look={LOOK.blank}>Unanswered</Key>
          {checked ? (
            <>
              <Key look={LOOK.right}>Right</Key>
              <Key look={LOOK.wrong}>Wrong</Key>
            </>
          ) : (
            <Key look={LOOK.answered}>Answered</Key>
          )}
          <span className="flex items-center gap-1.5">
            <Bookmark size={13} strokeWidth={2} fill="currentColor" aria-hidden="true" className="text-fill-watch" /> For review
          </span>
        </p>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {groups.map((g) => (
            <section key={g.title} className="mb-3 last:mb-0">
              {g.title && (
                <h3 className="t-micro mb-2 text-ink-3">
                  {g.title} <span className="tabular">{g.list.length}</span>
                </h3>
              )}
              <div className="grid grid-cols-6 gap-2 min-[400px]:grid-cols-7">
                {g.list.map((x) => (
                  <button
                    key={x.n}
                    type="button"
                    onClick={() => onGo(x.n)}
                    aria-current={x.n === current || undefined}
                    aria-label={`Question ${x.n}, ${WORD[x.state]}${x.marked ? ', marked for review' : ''}${x.n === current ? ', current' : ''}`}
                    className={`t-subhead tabular relative flex h-10 items-center justify-center rounded-[10px] font-bold transition-transform active:scale-95 ${LOOK[x.state]} ${x.n === current ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'hover:brightness-95'}`}>
                    {x.n}
                    {x.marked && <Bookmark size={13} strokeWidth={2} fill="currentColor" aria-hidden="true" className="absolute -right-1 -top-1.5 text-fill-watch" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="border-t border-line px-4 py-3">{footer}</div>
      </div>
    </>
  );
}

function Key({ look, children }: { look: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3.5 rounded-[4px] ${look}`} /> {children}
    </span>
  );
}
