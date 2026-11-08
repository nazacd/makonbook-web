import { Bookmark, ClipboardList, Dumbbell, Lock, Smartphone, SpellCheck, type LucideIcon } from 'lucide-react';

import { useMe } from '@/api/queries';
import type { Profile } from '@/api/types';
import { useProvePhone } from '@/components/shell/ProvePhone';
import { normalCase } from '@/lib/groups';
import { useTitle } from '@/lib/title';

const FEATURES: { label: string; text: string; icon: LucideIcon }[] = [
  { label: 'Mock tests', text: 'Full SAT practice tests, timed like the real thing.', icon: ClipboardList },
  { label: 'Training Hall', text: 'Your mistakes, sorted by skill, to practise again.', icon: Dumbbell },
  { label: 'Vocabulary', text: 'SAT words with spaced repetition.', icon: SpellCheck },
  { label: 'Problem questions', text: 'Questions you saved to ask about later.', icon: Bookmark },
];

// The dashboard of an account without a phone number: everything is locked
// until the number is proven.
export function LockedHome() {
  useTitle('Dashboard');
  const profile = useMe().data as Profile;
  const prove = useProvePhone();
  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <header className="mb-5 flex items-center gap-3 pt-1">
        <span className="text-[30px] leading-none" aria-hidden="true">
          👋
        </span>
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink">Hi {normalCase(`${profile.first_name} ${profile.last_name}`)}</h1>
      </header>
      <section className="rise relative overflow-hidden rounded-card bg-primary p-6 text-on-primary md:p-8">
        <div className="relative max-w-xl">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-white/15">
            <Smartphone size={22} aria-hidden="true" />
          </span>
          <h2 className="text-[24px] font-bold leading-8">One step left: prove your phone number</h2>
          <p className="mt-2 text-[15px] leading-6 opacity-85">SATMAKON opens once your account has a proven number. It takes a minute, by SMS or with Telegram. Already have an account with that number? We’ll take you to it.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={prove} className="lift h-11 rounded-full bg-surface px-6 text-[15px] font-bold text-ink">
              Prove my number
            </button>
          </div>
        </div>
      </section>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <button key={f.label} type="button" onClick={prove} className="group rounded-card border border-line bg-surface p-5 text-left hover:bg-surface-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-[11px] bg-accent-tint text-primary">
                <f.icon size={19} aria-hidden="true" />
              </span>
              <Lock size={16} className="text-ink-3 group-hover:text-primary" aria-label="Locked" />
            </div>
            <p className="t-headline text-ink">{f.label}</p>
            <p className="t-footnote mt-1 text-ink-2">{f.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
