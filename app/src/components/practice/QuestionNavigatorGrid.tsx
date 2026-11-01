import { Bookmark, MapPin } from 'lucide-react';

export type QuestionOutcome = 'correct' | 'incorrect' | 'skipped';

type ProgressItem = { id: number; current: boolean; answered: boolean; marked: boolean };
type ResultItem = { id: number; outcome: QuestionOutcome };

type Props =
  | { variant: 'progress'; items: ProgressItem[]; onPress: (id: number) => void }
  | { variant: 'results'; items: ResultItem[]; onPress: (id: number) => void };

const OUTCOME_WORD: Record<QuestionOutcome, string> = { correct: 'right', incorrect: 'wrong', skipped: 'blank' };

/** Bluebook's legend over the grid: current (a pin), unanswered (dashed), for review (a bookmark). */
export function NavigatorLegend() {
  return (
    <p className="t-footnote flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-2">
      <span className="flex items-center gap-1">
        <MapPin size={14} strokeWidth={2} aria-hidden="true" className="text-ink" /> Current
      </span>
      <span className="flex items-center gap-1">
        <span className="size-3.5 rounded-[3px] border border-dashed border-ink-2" /> Unanswered
      </span>
      <span className="flex items-center gap-1">
        <Bookmark size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" className="text-accent" /> For review
      </span>
    </p>
  );
}

// The question grid. In progress (Bluebook's): a dashed box while blank, a
// solid one once answered, a pin over the current one, a bookmark on the
// ones marked. In results: right, wrong and blank differ by fill, not only
// by colour, so they read in grayscale too.
export function QuestionNavigatorGrid(props: Props) {
  if (props.variant === 'progress') {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-5 pt-4">
        {props.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onPress(item.id)}
            aria-current={item.current || undefined}
            aria-label={`Question ${item.id}${item.answered ? ', answered' : ', unanswered'}${item.marked ? ', marked for review' : ''}${item.current ? ', current' : ''}`}
            className={`relative flex h-10 w-11 items-center justify-center rounded-md border t-subhead font-bold text-accent ${item.answered ? 'border-accent bg-accent-tint' : 'border-dashed border-ink-2 bg-paper'}`}>
            {item.id}
            {item.current && <MapPin size={16} strokeWidth={2.25} aria-hidden="true" className="absolute -top-4 left-1/2 -translate-x-1/2 text-ink" />}
            {item.marked && <Bookmark size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" className="absolute -right-1 -top-1.5 text-accent" />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-[11px] gap-y-2.5">
      {props.items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => props.onPress(item.id)}
          aria-label={`Question ${item.id}, ${OUTCOME_WORD[item.outcome]}`}
          className={`flex size-11 items-center justify-center rounded-[12px] t-subhead tabular active:opacity-70 ${
            item.outcome === 'correct' ? 'bg-good-tint font-medium text-ink' : item.outcome === 'incorrect' ? 'bg-bad font-bold text-brand' : 'border-[1.5px] border-dashed border-line-strong font-medium text-ink-3'
          }`}>
          {item.id}
        </button>
      ))}
    </div>
  );
}
