import { X } from 'lucide-react';

import { useDialog } from '@/lib/dialog';
import type { Subject } from '@/lib/practice/types';

// The section's directions, behind "Directions" in the header, as in Bluebook.
const TEXT: Record<Subject, string[]> = {
  english: [
    'The questions in this section cover reading and writing skills. Each question has one or more passages, which may include a table or graph. Read each passage and question carefully, then choose the best answer based on the passage or passages.',
    'All questions in this section are multiple choice with four answer choices. Each question has a single best answer.',
  ],
  math: [
    'The questions in this section cover a range of important math skills. A calculator is allowed on every question. Unless stated otherwise, figures are drawn to scale, lie in a plane, and the domain of a function is the set of all real numbers for which the function is defined.',
    'For multiple-choice questions, choose the best answer. For student-produced response questions, type your answer: a number or a fraction (for example 1/2). Don’t type a mixed number; 3 1/2 should be entered as 7/2 or 3.5.',
  ],
};

export function Directions({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={dialog} tabIndex={-1} className="absolute inset-x-0 top-full z-30 px-4 pt-1 outline-none" role="dialog" aria-label="Directions">
      <div className="max-w-xl rounded-panel border border-line bg-paper p-5 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h2 className="t-headline text-ink">Directions</h2>
          <button type="button" onClick={onClose} aria-label="Close the directions" className="-mr-2 -mt-1 flex size-9 items-center justify-center rounded-chip active:bg-paper-2">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="t-subhead flex flex-col gap-2 text-ink-2">
          {TEXT[subject].map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <button type="button" onClick={onClose} className="t-subhead mt-4 h-9 rounded-full bg-accent px-4 font-semibold text-on-accent">
          Close
        </button>
      </div>
    </div>
  );
}
