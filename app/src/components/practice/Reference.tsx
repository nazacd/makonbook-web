import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Formula } from './RichContent';

// The Math reference sheet, as Bluebook's "Reference Sheet": each figure
// drawn with its formula under it, then the three facts. The drawings are
// inline SVG in the ink colour, so they follow the theme.

const S = 'currentColor';
const stroke = { fill: 'none', stroke: S, strokeWidth: 1.3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const dashed = { ...stroke, strokeDasharray: '3 2.5' };
const label = { fill: S, fontSize: 10, fontStyle: 'italic', fontFamily: 'Georgia, serif' } as const;

const FIGURES: { id: string; draw: ReactNode; tex: string[]; caption?: string }[] = [
  {
    id: 'circle',
    draw: (
      <g>
        <circle cx="50" cy="40" r="30" {...stroke} />
        <line x1="50" y1="40" x2="80" y2="40" {...stroke} />
        <text x="63" y="36" {...label}>r</text>
      </g>
    ),
    tex: ['A = \\pi r^2', 'C = 2\\pi r'],
  },
  {
    id: 'rectangle',
    draw: (
      <g>
        <rect x="14" y="18" width="72" height="44" {...stroke} />
        <text x="46" y="78" {...label}>ℓ</text>
        <text x="90" y="44" {...label}>w</text>
      </g>
    ),
    tex: ['A = \\ell w'],
  },
  {
    id: 'triangle',
    draw: (
      <g>
        <polygon points="12,66 88,66 36,16" {...stroke} />
        <line x1="36" y1="16" x2="36" y2="66" {...dashed} />
        <polyline points="36,60 42,60 42,66" {...stroke} />
        <text x="26" y="44" {...label}>h</text>
        <text x="48" y="78" {...label}>b</text>
      </g>
    ),
    tex: ['A = \\tfrac{1}{2} b h'],
  },
  {
    id: 'right',
    draw: (
      <g>
        <polygon points="12,66 88,66 88,16" {...stroke} />
        <polyline points="82,66 82,60 88,60" {...stroke} />
        <text x="42" y="36" {...label}>c</text>
        <text x="92" y="44" {...label}>a</text>
        <text x="48" y="78" {...label}>b</text>
      </g>
    ),
    tex: ['c^2 = a^2 + b^2'],
  },
  {
    id: 'thirty',
    draw: (
      <g>
        <polygon points="14,66 92,66 14,16" {...stroke} />
        <polyline points="14,60 20,60 20,66" {...stroke} />
        <text x="17" y="42" {...label} fontStyle="normal">60°</text>
        <text x="58" y="64" {...label} fontStyle="normal">30°</text>
        <text x="4" y="44" {...label}>x</text>
        <text x="40" y="78" {...label}>x√3</text>
        <text x="52" y="38" {...label}>2x</text>
      </g>
    ),
    tex: [],
    caption: 'Special right triangles',
  },
  {
    id: 'fortyfive',
    draw: (
      <g>
        <polygon points="14,66 70,66 14,10" {...stroke} />
        <polyline points="14,60 20,60 20,66" {...stroke} />
        <text x="16" y="40" {...label} fontStyle="normal">45°</text>
        <text x="44" y="64" {...label} fontStyle="normal">45°</text>
        <text x="4" y="42" {...label}>s</text>
        <text x="38" y="78" {...label}>s</text>
        <text x="50" y="36" {...label}>s√2</text>
      </g>
    ),
    tex: [],
    caption: 'Special right triangles',
  },
  {
    id: 'box',
    draw: (
      <g>
        <rect x="14" y="30" width="54" height="38" {...stroke} />
        <polyline points="14,30 30,16 84,16 84,54 68,68" {...stroke} />
        <line x1="68" y1="30" x2="84" y2="16" {...stroke} />
        <polyline points="14,68 30,54 84,54" {...dashed} />
        <line x1="30" y1="54" x2="30" y2="16" {...dashed} />
        <text x="38" y="80" {...label}>ℓ</text>
        <text x="78" y="66" {...label}>w</text>
        <text x="88" y="40" {...label}>h</text>
      </g>
    ),
    tex: ['V = \\ell w h'],
  },
  {
    id: 'cylinder',
    draw: (
      <g>
        <ellipse cx="50" cy="20" rx="30" ry="8" {...stroke} />
        <path d="M20 20v42a30 8 0 0 0 60 0V20" {...stroke} />
        <path d="M20 62a30 8 0 0 1 60 0" {...dashed} />
        <line x1="50" y1="20" x2="80" y2="20" {...dashed} />
        <text x="62" y="17" {...label}>r</text>
        <text x="86" y="46" {...label}>h</text>
      </g>
    ),
    tex: ['V = \\pi r^2 h'],
  },
  {
    id: 'sphere',
    draw: (
      <g>
        <circle cx="50" cy="42" r="30" {...stroke} />
        <path d="M20 42a30 9 0 0 0 60 0" {...stroke} />
        <path d="M20 42a30 9 0 0 1 60 0" {...dashed} />
        <line x1="50" y1="42" x2="80" y2="42" {...dashed} />
        <text x="63" y="39" {...label}>r</text>
      </g>
    ),
    tex: ['V = \\tfrac{4}{3}\\pi r^3'],
  },
  {
    id: 'cone',
    draw: (
      <g>
        <path d="M20 62L50 10L80 62" {...stroke} />
        <path d="M20 62a30 8 0 0 0 60 0" {...stroke} />
        <path d="M20 62a30 8 0 0 1 60 0" {...dashed} />
        <line x1="50" y1="10" x2="50" y2="62" {...dashed} />
        <line x1="50" y1="62" x2="80" y2="62" {...dashed} />
        <text x="40" y="44" {...label}>h</text>
        <text x="62" y="58" {...label}>r</text>
      </g>
    ),
    tex: ['V = \\tfrac{1}{3}\\pi r^2 h'],
  },
  {
    id: 'pyramid',
    draw: (
      <g>
        <polygon points="14,64 56,72 94,56 50,10" {...stroke} />
        <line x1="50" y1="10" x2="56" y2="72" {...stroke} />
        <polyline points="14,64 46,48 94,56" {...dashed} />
        <line x1="50" y1="10" x2="50" y2="58" {...dashed} />
        <text x="40" y="40" {...label}>h</text>
        <text x="30" y="82" {...label}>ℓ</text>
        <text x="80" y="70" {...label}>w</text>
      </g>
    ),
    tex: ['V = \\tfrac{1}{3}\\ell w h'],
  },
];

const NOTES = ['The number of degrees of arc in a circle is 360.', 'The number of radians of arc in a circle is 2π.', 'The sum of the measures in degrees of the angles of a triangle is 180.'];

export function Reference({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-3 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label="Reference sheet" className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-panel bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-12 items-center justify-between bg-ink px-4">
          <h2 className="t-headline text-paper">Reference Sheet</h2>
          <button type="button" onClick={onClose} aria-label="Close the reference sheet" className="flex size-9 items-center justify-center rounded-chip text-paper active:bg-ink-2">
            <X size={20} strokeWidth={2} aria-hidden="true" className="text-current" />
          </button>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 text-ink sm:grid-cols-4">
            {FIGURES.map((f) => (
              <li key={f.id} className="flex flex-col items-center gap-1 text-center">
                <svg width={110} height={86} viewBox="0 0 110 86" aria-hidden="true" className="text-ink">
                  {f.draw}
                </svg>
                {f.caption && <span className="t-footnote text-ink-2">{f.caption}</span>}
                {f.tex.map((t) => (
                  <span key={t} className="rich">
                    <Formula tex={t} display={false} />
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <ul className="t-subhead mt-6 flex flex-col gap-1.5 border-t border-line pt-4 text-ink">
            {NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
