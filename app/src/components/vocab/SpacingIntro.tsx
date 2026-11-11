import { useState } from 'react';

import { Action, Modal } from '@/components/ui';

// How the flashcards work, in three pictures: memory fades; a look at the
// right moment lifts it back; each look makes it fade more slowly, so the
// gaps grow. Shown once before the first session and from "How it works".

type Slide = { title: string; text: string; reviews: number[] };

const SLIDES: Slide[] = [
  { title: 'A new word fades fast', text: 'Learn a word today and most of it is gone within a few days. That is how memory works, for everyone.', reviews: [] },
  { title: 'Unless you meet it again', text: 'Seeing the word just before you would forget it brings it all the way back, and it fades more slowly afterwards.', reviews: [60] },
  { title: 'So the gaps get longer', text: 'Tomorrow, then in four days, then in two weeks. SATMAKON picks the day for every word from how well you knew it: Again, Hard, Good or Easy.', reviews: [44, 104, 196] },
];

const W = 320;
const H = 150;
const TOP = 18;
const BASE = 126;

/** The forgetting curve: memory drops from full after each review, more slowly each time. */
function Curve({ reviews }: { reviews: number[] }) {
  const starts = [8, ...reviews];
  let d = '';
  starts.forEach((x0, i) => {
    const x1 = starts[i + 1] ?? W - 8;
    const slow = 1 + i * 1.6; // each review, the fall is gentler
    const drop = (x: number) => TOP + (BASE - TOP) * (1 - Math.exp(-(x - x0) / (26 * slow)));
    d += `${i ? ' L' : 'M'}${x0},${TOP}`;
    for (let x = x0 + 4; x <= x1; x += 4) d += ` L${x},${drop(x).toFixed(1)}`;
    d += ` L${x1},${drop(x1).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="How well a word is remembered over time">
      <line x1="8" y1={BASE + 8} x2={W - 8} y2={BASE + 8} stroke="var(--color-line-strong)" strokeWidth="1.5" />
      <line x1="8" y1={TOP} x2={W - 8} y2={TOP} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" />
      {reviews.map((x) => (
        <line key={x} x1={x} y1={TOP} x2={x} y2={BASE + 8} stroke="var(--color-fill-good)" strokeWidth="1.5" strokeDasharray="2 4" />
      ))}
      <path key={reviews.join()} d={d} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="curve-draw" style={{ ['--len' as string]: 900 }} />
      {reviews.map((x) => (
        <circle key={x} cx={x} cy={TOP} r="5" fill="var(--color-fill-good)" stroke="var(--color-surface)" strokeWidth="2" />
      ))}
      <text x="10" y={TOP - 6} fontSize="10" fill="var(--color-ink-3)">
        remembered
      </text>
      <text x={W - 10} y={BASE + 22} fontSize="10" textAnchor="end" fill="var(--color-ink-3)">
        time
      </text>
    </svg>
  );
}

export function SpacingIntro({ onClose, cta = 'Got it' }: { onClose: () => void; cta?: string }) {
  const [at, setAt] = useState(0);
  const slide = SLIDES[at]!;
  const last = at === SLIDES.length - 1;
  return (
    <Modal
      title="How the words stick"
      onClose={onClose}
      width={460}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`Step ${at + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-6 bg-primary' : 'w-1.5 bg-line-strong'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {at > 0 && (
              <Action variant="outline" onClick={() => setAt(at - 1)}>
                Back
              </Action>
            )}
            <Action onClick={() => (last ? onClose() : setAt(at + 1))}>{last ? cta : 'Next'}</Action>
          </div>
        </div>
      }>
      <div className="rounded-card bg-surface-2 p-3">
        <Curve reviews={slide.reviews} />
      </div>
      <h3 className="t-title3 mt-4 text-ink">{slide.title}</h3>
      <p className="t-body mt-1.5 min-h-[72px] text-ink-2">{slide.text}</p>
    </Modal>
  );
}
