import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import type { AssignmentQuestion, ImageLinks as ApiImageLinks } from '@/api/assignments';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '@/components/practice/results/format';
import { RichContent, type ImageLinks } from '@/components/practice/RichContent';
import type { PackageImage } from '@/lib/practice/types';

// A question as a teacher sees it: passage, question, choices with the key
// marked (or a grid-in's accepted answers), and the explanation folded away.

/** The API's image links in the shape RichContent takes. */
export function useRichImages(links: ApiImageLinks | undefined) {
  return useMemo(() => {
    const images: Record<string, PackageImage> = {};
    const out: ImageLinks = {};
    for (const [key, img] of Object.entries(links ?? {})) {
      images[key] = { file: key, bytes: 0, width: img.width, height: img.height };
      out[key] = img.url;
    }
    return { images, links: out };
  }, [links]);
}

export type RichImages = ReturnType<typeof useRichImages>;

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuestionTags({ q }: { q: Pick<AssignmentQuestion, 'skill' | 'difficulty' | 'type'> }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold">
      <span className="text-ink-2">{q.skill}</span>
      {q.difficulty && <span style={{ color: DIFFICULTY_COLOR[q.difficulty] }}>{DIFFICULTY_LABEL[q.difficulty]}</span>}
      {q.type === 'grid_in' && <span className="text-ink-3">Grid-in</span>}
    </span>
  );
}

/**
 * The question's body. `marks` paints a choice (the student's answer) and
 * `side` adds a note to a choice (how many picked it).
 */
export function QuestionView({ q, img, given, side, showKey = true, compact = false }: { q: AssignmentQuestion; img: RichImages; given?: string | null; side?: (letter: string) => ReactNode; showKey?: boolean; compact?: boolean }) {
  const [explain, setExplain] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {q.passage && (
        <div className={`rounded-control border border-line bg-surface-2 px-3.5 py-3 ${compact ? 'max-h-48 overflow-y-auto' : ''}`}>
          <RichContent text={q.passage} images={img.images} links={img.links} className="rich rich-sm" />
        </div>
      )}
      <RichContent text={q.stem} images={img.images} links={img.links} className="rich rich-sm" />
      {q.choices ? (
        <ul className="flex flex-col gap-1.5">
          {LETTERS.filter((l) => q.choices![l] != null).map((l) => {
            const key = showKey && q.correct === l;
            const picked = given === l;
            const tone = key ? 'border-good bg-good-tint/60' : picked ? 'border-bad bg-bad-tint/60' : 'border-line bg-surface';
            return (
              <li key={l} className={`flex items-center gap-2.5 rounded-control border px-3 py-2 ${tone}`}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${key ? 'border-good bg-good text-white' : picked ? 'border-bad bg-bad text-white' : 'border-line-strong text-ink-2'}`}>{l}</span>
                <span className="min-w-0 flex-1">
                  <RichContent text={q.choices![l]} images={img.images} links={img.links} className="rich rich-sm" displayMath />
                </span>
                {side?.(l)}
                {key && <Check size={16} className="shrink-0 text-good" aria-label="Correct answer" />}
              </li>
            );
          })}
        </ul>
      ) : (
        showKey && (
          <p className="t-subhead rounded-control border border-good/40 bg-good-tint/50 px-3 py-2 text-ink">
            <span className="font-semibold text-good">Accepted: </span>
            {(q.accepted ?? []).join(', ') || '—'}
            {given != null && (
              <span className="ml-3 text-ink-2">
                Answer given: <b className="text-ink">{given || 'blank'}</b>
              </span>
            )}
          </p>
        )
      )}
      {showKey && q.explanation && (
        <div>
          <button type="button" onClick={() => setExplain((v) => !v)} aria-expanded={explain} className="t-footnote inline-flex items-center gap-1 font-bold text-accent hover:underline">
            {explain ? 'Hide explanation' : 'Show explanation'} <ChevronDown size={14} className={`transition-transform ${explain ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {explain && (
            <div className="mt-2 rounded-control border-l-[3px] border-info bg-surface-2 px-3.5 py-3">
              <RichContent text={q.explanation} images={img.images} links={img.links} className="rich rich-sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
