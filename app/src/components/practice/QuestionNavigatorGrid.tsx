export type QuestionOutcome = 'correct' | 'incorrect' | 'skipped';

type ProgressItem = { id: number; current: boolean; answered: boolean; marked: boolean };
type ResultItem = { id: number; outcome: QuestionOutcome };

type Props =
  | { variant: 'progress'; items: ProgressItem[]; onPress: (id: number) => void }
  | { variant: 'results'; items: ResultItem[]; onPress: (id: number) => void };

const OUTCOME_WORD: Record<QuestionOutcome, string> = { correct: 'right', incorrect: 'wrong', skipped: 'blank' };

// Right, wrong and blank differ by fill, not only by colour, so they read in
// grayscale too: a soft green tile, a solid terracotta one, a dashed outline.
export function QuestionNavigatorGrid(props: Props) {
  if (props.variant === 'progress') {
    return (
      <div className="flex flex-wrap gap-3">
        {props.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onPress(item.id)}
            aria-current={item.current || undefined}
            aria-label={`Question ${item.id}${item.answered ? ', answered' : ', blank'}${item.marked ? ', marked for review' : ''}`}
            className={`relative flex size-11 items-center justify-center rounded-lg border t-subhead font-semibold ${
              item.current ? 'border-accent bg-accent text-on-accent' : item.answered ? 'border-accent bg-accent-tint text-ink' : 'border-dashed border-line-strong bg-paper text-ink'
            }`}>
            {item.id}
            {item.marked && <span className={`absolute -right-1 -top-1 size-2.5 rounded-full ${item.current ? 'bg-fill-watch' : 'bg-accent'}`} />}
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
