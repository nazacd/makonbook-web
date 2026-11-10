import { RotateCcw } from 'lucide-react';

import type { University } from '@/api/universities';
import { Spinner } from '@/components/Button';

import { UniversityCard } from './UniversityCard';
import { UniversityPicker } from './UniversityPicker';

// Choosing the dream university, over the globe: the picker on glass (left on
// laptops, on top on phones) and the chosen university's card. Onboarding's
// second step, and the /dream page.

export function DreamStep({
  list,
  loading,
  failed,
  dream,
  browsing,
  onBrowse,
  onChoose,
  onLook,
  onMatches,
}: {
  list: University[] | undefined;
  loading: boolean;
  failed: boolean;
  dream: University | null;
  browsing: boolean;
  onBrowse: () => void;
  onChoose: (u: University) => void;
  onLook: (p: { lat: number; lng: number; zoom?: number }) => void;
  onMatches: (ids: string[]) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <section className="rise glass pointer-events-auto flex max-h-[54dvh] min-h-0 w-full flex-col rounded-[22px] p-4 md:max-h-[calc(100dvh-190px)] md:w-[400px] md:p-5">
        <h1 className="text-[22px] font-bold leading-7 tracking-[-0.02em] md:text-[26px] md:leading-8">Your dream university</h1>
        <p className="mb-3 mt-1 text-[14px] text-[var(--onb-ink-2)]">Search, pick a country, or tap a gold light on the globe.</p>
        {failed ? (
          <p className="text-[14px] text-[var(--onb-ink-2)]">Couldn’t load the universities. You can choose later from your profile.</p>
        ) : loading || !list ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-6 text-[var(--onb-gold)]" />
          </div>
        ) : !browsing && dream ? (
          <button type="button" onClick={onBrowse} className="choice flex items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-semibold">
            <RotateCcw size={15} aria-hidden="true" /> Choose another
          </button>
        ) : (
          <UniversityPicker universities={list} onSelect={onChoose} onLook={onLook} onMatches={onMatches} />
        )}
      </section>
      {dream && !browsing && (
        <div key={dream.id} className="pointer-events-auto w-full md:mt-8 md:w-[380px]">
          <UniversityCard u={dream} />
        </div>
      )}
    </div>
  );
}
