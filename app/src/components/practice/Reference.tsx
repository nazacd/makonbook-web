import { X } from 'lucide-react';

import { Formula } from './RichContent';

// The Math reference sheet, as Bluebook's "Reference": the formulas every
// SAT gives, drawn with MathJax.
const ROWS: { title: string; tex: string[] }[] = [
  { title: 'Circle', tex: ['A = \\pi r^2', 'C = 2\\pi r'] },
  { title: 'Rectangle', tex: ['A = \\ell w'] },
  { title: 'Triangle', tex: ['A = \\tfrac{1}{2} b h'] },
  { title: 'Right triangle', tex: ['c^2 = a^2 + b^2'] },
  { title: 'Special right triangles', tex: ['30°\\text{–}60°\\text{–}90°:\\, x,\\, x\\sqrt{3},\\, 2x', '45°\\text{–}45°\\text{–}90°:\\, s,\\, s,\\, s\\sqrt{2}'] },
  { title: 'Box', tex: ['V = \\ell w h'] },
  { title: 'Cylinder', tex: ['V = \\pi r^2 h'] },
  { title: 'Sphere', tex: ['V = \\tfrac{4}{3}\\pi r^3'] },
  { title: 'Cone', tex: ['V = \\tfrac{1}{3}\\pi r^2 h'] },
  { title: 'Pyramid', tex: ['V = \\tfrac{1}{3}\\ell w h'] },
];

const NOTES = ['The number of degrees of arc in a circle is 360.', 'The number of radians of arc in a circle is 2π.', 'The sum of the measures in degrees of the angles of a triangle is 180.'];

export function Reference({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Reference" className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-panel bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="t-headline text-ink">Reference</h2>
          <button type="button" onClick={onClose} aria-label="Close the reference" className="flex size-9 items-center justify-center rounded-chip active:bg-paper-2">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            {ROWS.map((r) => (
              <div key={r.title} className="contents">
                <dt className="t-subhead pt-0.5 text-ink-2">{r.title}</dt>
                <dd className="rich flex flex-wrap gap-x-6 gap-y-1">
                  {r.tex.map((t) => (
                    <Formula key={t} tex={t} display={false} />
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="t-subhead mt-5 flex list-disc flex-col gap-1 pl-5 text-ink-2">
            {NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
