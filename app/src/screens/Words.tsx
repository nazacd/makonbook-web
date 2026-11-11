import { ArrowRight, BookOpen, Check, CircleHelp, Clock, CloudUpload, Flame, Layers, Play, Plus, Shuffle, SlidersHorizontal, SpellCheck, Target, TextCursorInput, Type, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/ui';
import { ListsSheet, UnitChips } from '@/components/vocab/ListsSheet';
import { SpacingIntro } from '@/components/vocab/SpacingIntro';
import { UnitBar } from '@/components/vocab/UnitBar';
import { useNow } from '@/lib/clock';
import { usePerson } from '@/lib/practice/hooks';
import { addDays, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { clock, GAMES, loadBests, MIN_WORDS, nextMilestone, reviewsToday, streak } from '@/lib/vocab/games';
import { useDeck, useSaveSettings, useSettings, useVocabState, useVocabSync } from '@/lib/vocab/hooks';
import { introSeen, markIntroSeen, type Settings } from '@/lib/vocab/local';
import { almostDone, listName, listProgress } from '@/lib/vocab/progress';
import { activeLists, formatGap, newToday, queue } from '@/lib/vocab/scheduler';

import { TeacherWords } from './TeacherWords';

export function Words() {
  const kind = useMe().data?.kind;
  return kind === 'teacher' ? <TeacherWords /> : <StudentWords />;
}

// The student's Vocabulary: today's words and the way in to studying them,
// the ways to practise (the flashcards, which decide when a word comes back,
// and three games on the same words), the lists being studied, and on the
// side today's count, the streak and how far the lists have got. Setup (new
// words a day, which lists) is behind "Lists & pace".
function StudentWords() {
  useTitle('Vocabulary');
  const nowMs = useNow();
  const now = new Date(nowMs);
  const person = usePerson();
  const deck = useDeck();
  const state = useVocabState();
  const settings = useSettings();
  const save = useSaveSettings();
  const sync = useVocabSync(true);
  const [sheet, setSheet] = useState(false);
  const [bests] = useState(() => loadBests(person));
  // The explanation of spacing: offered once, before the first word is studied.
  const [intro, setIntro] = useState<'auto' | 'open' | 'closed'>(() => (introSeen(person) ? 'closed' : 'auto'));
  const closeIntro = () => {
    markIntroSeen(person);
    setIntro('closed');
  };

  const cards = state.data?.cards ?? new Map();
  const loaded: Settings = settings.data ?? { active: [], newPerDay: 20 };
  const s: Settings = { ...loaded, active: deck.data ? activeLists(loaded, deck.data, cards) : loaded.active };
  const log = state.data?.log ?? [];
  const newLeft = Math.max(0, s.newPerDay - newToday(log, now));
  const q = deck.data ? queue(deck.data, s.active, cards, now, newLeft) : null;
  const toStudy = q ? q.due.length + q.fresh.length : 0;
  let next: number | null = null;
  if (deck.data && toStudy === 0) {
    for (const l of deck.data.lists) {
      if (!s.active.includes(l.slug)) continue;
      for (const w of l.words) {
        const due = cards.get(w.id)?.due.getTime();
        if (due != null && (next == null || due < next)) next = due;
      }
    }
  }
  const studying = deck.data?.lists.filter((l) => s.active.includes(l.slug)) ?? [];
  const nearlyDone = deck.data ? almostDone(deck.data, s.active, cards, s.newPerDay) : null;
  const add = (slug: string) => save.mutate({ ...s, active: [...s.active, slug] });

  const today = schoolDate(nowMs);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const reviewed = new Set(log.map((r) => schoolDate(Date.parse(r.reviewed_at))));
  const doneToday = reviewsToday(log, nowMs);
  const days = streak(log, nowMs);
  const totals = studying.reduce(
    (t, l) => {
      const p = listProgress(l, cards);
      return { total: t.total + p.total, learned: t.learned + p.learned, started: t.started + p.started };
    },
    { total: 0, learned: 0, started: 0 },
  );
  const milestone = nextMilestone(totals.learned);
  const upNext = q ? (q.due[0] ?? q.fresh[0]) : undefined;
  const wordsToPlay = studying.reduce((n, l) => n + l.words.length, 0);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader
        icon={SpellCheck}
        title="Vocabulary"
        subtitle="SAT words, spaced out so they stick."
        actions={
          deck.data && deck.data.lists.length > 0 ? (
            <>
              <button type="button" onClick={() => setIntro('open')} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
                <CircleHelp size={16} aria-hidden="true" /> How it works
              </button>
              <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-surface-2">
                <SlidersHorizontal size={16} aria-hidden="true" /> Lists & pace
              </button>
            </>
          ) : undefined
        }
      />
      {!deck.data ? (
        deck.isPending || sync.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton height={190} radius={20} />
            <Skeleton height={130} radius={16} />
          </div>
        ) : (
          <ErrorState title="Couldn’t load the words" message={sync.error ? describeError(sync.error) : 'Try again.'} onRetry={() => void sync.refetch()} retrying={sync.isFetching} />
        )
      ) : deck.data.lists.length === 0 ? (
        <EmptyState icon={BookOpen} title="Words are on the way" message="The word lists appear here once they are ready." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="vocab-hero relative overflow-hidden rounded-panel p-6 text-white sm:p-7">
              <div className="relative z-[1] flex flex-wrap items-end justify-between gap-5 sm:max-w-[62%]">
                {s.active.length === 0 ? (
                  <div>
                    <h2 className="text-[28px] font-bold leading-9 tracking-[-0.02em]">Pick a list to start</h2>
                    <p className="t-subhead mt-1.5 max-w-[420px] text-white/75">About 25 SAT words in each. {listName(deck.data.lists[0]!.title)} is a good first one.</p>
                  </div>
                ) : toStudy > 0 ? (
                  <div>
                    <p className="t-number text-[68px] leading-[68px]" aria-label={`${toStudy} words today`}>
                      {toStudy}
                    </p>
                    <p className="t-subhead mt-1 text-white/75">{toStudy === 1 ? 'word is' : 'words are'} waiting for you today</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {q!.fresh.length > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold">{q!.fresh.length} new</span>}
                      {q!.due.length > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold">{q!.due.length} to review</span>}
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold">about {Math.max(1, Math.round(toStudy / 4))} min</span>
                    </div>
                    <Link to="/words/study" className="lift mt-5 inline-flex h-12 items-center gap-2 rounded-[14px] bg-white px-6 text-[15px] font-bold text-[#2c0066]">
                      <Play size={17} fill="currentColor" aria-hidden="true" /> Start studying
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="flex items-center gap-2.5">
                      <span className="flex size-[34px] items-center justify-center rounded-full bg-white/15">
                        <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span className="text-[26px] font-bold">All caught up</span>
                    </p>
                    <p className="t-subhead mt-3 flex items-center gap-2 text-white/75">
                      <Clock size={16} aria-hidden="true" />
                      {next != null ? `Next word in ${formatGap(next - nowMs)}` : 'Add a list for more words'}
                      {newLeft === 0 ? ' · today’s new words are done' : ''}
                    </p>
                    {wordsToPlay >= MIN_WORDS && <p className="t-subhead mt-1.5 text-white/75">A game keeps them warm until then.</p>}
                  </div>
                )}
              </div>
              {/* A fan of cards: the word that comes first today on top. */}
              <div className="pointer-events-none absolute -right-6 bottom-[-34px] hidden h-[190px] w-[250px] sm:block" aria-hidden="true">
                <span className="absolute inset-0 rotate-[14deg] rounded-[18px] bg-white/10" />
                <span className="absolute inset-0 rotate-[5deg] rounded-[18px] bg-white/20" />
                <span className="absolute inset-0 flex -rotate-[5deg] flex-col justify-center rounded-[18px] bg-white px-6 text-[#1a0b3d] shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
                  <span className="font-title truncate text-[30px] font-bold leading-9">{upNext?.word ?? 'well done'}</span>
                  <span className="mt-1 text-[13px] italic text-[#5b6472]">{upNext ? (upNext.part_of_speech ?? 'next up') : 'nothing due'}</span>
                </span>
              </div>
            </section>

            {s.active.length === 0 ? (
              <section className="rounded-card border border-line bg-surface p-5">
                <UnitChips lists={deck.data.lists} onAdd={add} />
              </section>
            ) : (
              <>
                <section aria-labelledby="ways">
                  <h2 id="ways" className="t-headline mb-2.5 text-ink">
                    Ways to practise
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    <Mode to="/words/study" icon={Layers} accent="var(--color-violet)" title="Flashcards" blurb="Recall the meaning, then rate yourself. This sets when each word returns" chip={toStudy > 0 ? `${toStudy} today` : 'Done for today'} chipOn={toStudy > 0} />
                    <Mode to={GAMES.pairs.path} icon={Shuffle} accent="var(--color-teal)" title={GAMES.pairs.title} blurb={GAMES.pairs.blurb} chip={bests.pairs.best != null ? `Best ${clock(bests.pairs.best)}` : 'New'} chipOn={bests.pairs.best == null} locked={wordsToPlay < MIN_WORDS} />
                    <Mode to={GAMES.unscramble.path} icon={Type} accent="var(--color-orange)" title={GAMES.unscramble.title} blurb={GAMES.unscramble.blurb} chip={bests.unscramble.best != null ? `Best ${bests.unscramble.best}/8` : 'New'} chipOn={bests.unscramble.best == null} locked={wordsToPlay < MIN_WORDS} />
                    <Mode to={GAMES.gap.path} icon={TextCursorInput} accent="var(--color-pink)" title={GAMES.gap.title} blurb={GAMES.gap.blurb} chip={bests.gap.best != null ? `Best ${bests.gap.best}/10` : 'New'} chipOn={bests.gap.best == null} locked={wordsToPlay < MIN_WORDS} />
                  </ul>
                  <p className="t-footnote mt-2 text-ink-3">The games are extra practice: only the flashcards move a word’s next review.</p>
                </section>

                <section aria-labelledby="lists">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h2 id="lists" className="t-headline text-ink">
                      Your lists
                    </h2>
                    <button type="button" onClick={() => setSheet(true)} className="t-subhead inline-flex min-h-9 items-center gap-1 font-semibold text-accent hover:underline">
                      <Plus size={15} aria-hidden="true" /> Add a list
                    </button>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {studying.map((l) => {
                      const p = listProgress(l, cards);
                      return (
                        <li key={l.slug}>
                          <Link to={`/words/list/${encodeURIComponent(l.slug)}`} aria-label={`${listName(l.title)}, ${p.learned} of ${p.total} learned`} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-primary/40">
                            <span className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-tint text-[16px] font-extrabold text-primary">{listName(l.title).replace(/\D/g, '') || listName(l.title)[0]}</span>
                                <span>
                                  <span className="t-headline block text-ink">{listName(l.title)}</span>
                                  <span className="t-footnote text-ink-3">
                                    {p.total} words · {p.started - p.learned} learning
                                  </span>
                                </span>
                              </span>
                              <span className="t-subhead tabular text-ink-2">
                                {p.learned}/{p.total}
                              </span>
                            </span>
                            <UnitBar progress={p} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {nearlyDone && (
                    <p className="t-subhead mt-2 flex flex-wrap items-center gap-x-2 text-ink-2">
                      <Icon as={Layers} size={17} className="text-ink-3" />
                      {listName(nearlyDone.ending.title)} almost done ·
                      <button type="button" onClick={() => add(nearlyDone.next.slug)} className="flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline">
                        <Icon as={Plus} size={15} className="text-accent" />
                        Add {listName(nearlyDone.next.title)}
                      </button>
                    </p>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-4">
                <Ring value={doneToday + toStudy > 0 ? doneToday / (doneToday + toStudy) : 0} done={toStudy === 0 && doneToday > 0} />
                <div>
                  <h2 className="t-headline text-ink">Today</h2>
                  <p className="t-number mt-0.5 text-[26px] leading-8 text-ink">{doneToday}</p>
                  <p className="t-footnote text-ink-2">{doneToday === 1 ? 'answer' : 'answers'} so far{toStudy > 0 ? ` · ${toStudy} to go` : ''}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="t-subhead flex items-center gap-1.5 font-semibold text-ink">
                    <Flame size={16} aria-hidden="true" className={days > 0 ? 'text-orange' : 'text-ink-3'} />
                    {days > 0 ? `${days}-day streak` : 'No streak yet'}
                  </h2>
                  <span className="t-footnote text-ink-2">{week.filter((d) => reviewed.has(d)).length} of 7 days</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {week.map((d) => (
                    <span key={d} className="flex flex-col items-center gap-1">
                      <span className="t-caption text-ink-3">{'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                      <span className={`flex size-8 items-center justify-center rounded-full ${reviewed.has(d) ? (d === today ? 'bg-primary text-on-primary' : 'bg-accent-tint text-accent') : d === today ? 'border-2 border-primary' : 'border border-line'}`}>
                        {reviewed.has(d) && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                      </span>
                    </span>
                  ))}
                </div>
                {days > 0 && !reviewed.has(today) && <p className="t-footnote mt-3 text-ink-2">Study today to keep it going.</p>}
              </div>
            </section>
            {totals.total > 0 && (
              <section className="rounded-card border border-line bg-surface p-5">
                <h2 className="t-headline mb-3 text-ink">Your progress</h2>
                <p className="t-number text-[32px] leading-9 text-ink">{Math.round((totals.learned / totals.total) * 100)}%</p>
                <p className="t-footnote text-ink-2">of the words in your lists learned</p>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-track" role="img" aria-label={`${totals.learned} learned, ${totals.started - totals.learned} learning, ${totals.total - totals.started} new`}>
                  <span className="bg-fill-good" style={{ width: `${(100 * totals.learned) / totals.total}%` }} />
                  <span className="bg-primary/55" style={{ width: `${(100 * (totals.started - totals.learned)) / totals.total}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['New', totals.total - totals.started],
                    ['Learning', totals.started - totals.learned],
                    ['Learned', totals.learned],
                  ].map(([label, n]) => (
                    <div key={label} className="rounded-control bg-surface-2 py-2">
                      <p className="t-number text-[18px] text-ink">{n}</p>
                      <p className="t-caption text-ink-2">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="t-footnote mt-3 flex items-center gap-1.5 text-ink-2">
                  <Target size={15} aria-hidden="true" className="text-ink-3" />
                  Next milestone: {milestone} words learned ({milestone - totals.learned} to go)
                </p>
              </section>
            )}
            {(sync.data?.pending ?? 0) > 0 && (
              <p className="t-footnote flex items-center gap-2 text-ink-2">
                <Icon as={CloudUpload} size={16} className="text-ink-3" />
                Progress sends to your teachers when you’re online
              </p>
            )}
            {!sync.isPending && sync.isError && <p className="t-footnote text-ink-3">Couldn’t sync just now; studying goes on with what is here.</p>}
          </aside>
        </div>
      )}
      {sheet && deck.data && (
        <ListsSheet
          deck={deck.data}
          settings={s}
          onClose={(nextSettings) => {
            setSheet(false);
            const changed = nextSettings.newPerDay !== s.newPerDay || nextSettings.active.join() !== s.active.join();
            if (changed) save.mutate(nextSettings);
          }}
        />
      )}
      {(intro === 'open' || (intro === 'auto' && state.data != null && state.data.log.length === 0 && s.active.length > 0)) && <SpacingIntro onClose={closeIntro} />}
    </div>
  );
}

/** One way to practise: a tinted icon, what it is, where it stands, and the way in. */
function Mode({ to, icon: I, accent, title, blurb, chip, chipOn, locked = false }: { to: string; icon: LucideIcon; accent: string; title: string; blurb: string; chip: string; chipOn: boolean; locked?: boolean }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-[42px] items-center justify-center rounded-[12px]" style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
          <I size={21} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${locked ? 'bg-surface-2 text-ink-3' : chipOn ? 'text-white' : 'bg-surface-2 text-ink-2'}`} style={!locked && chipOn ? { background: accent } : undefined}>
          {locked ? 'Needs 5 words' : chip}
        </span>
      </span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span>
          <span className="t-headline block text-ink">{title}</span>
          <span className="t-footnote mt-0.5 block text-ink-2">{blurb}</span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 transition-colors group-hover:border-transparent group-hover:bg-primary group-hover:text-on-primary">
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </span>
    </>
  );
  return (
    <li>
      {locked ? (
        <div className="flex h-full flex-col justify-between rounded-card border border-line bg-surface p-4 opacity-60">{body}</div>
      ) : (
        <Link to={to} className="group flex h-full flex-col justify-between rounded-card border border-line bg-surface p-4 transition-colors hover:border-primary/40">
          {body}
        </Link>
      )}
    </li>
  );
}

/** Today's answers against what was waiting, as a ring. */
function Ring({ value, done }: { value: number; done: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${Math.round(value * 100)}% of today’s words done`} className="shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-track)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={done ? 'var(--color-fill-good)' : 'var(--color-primary)'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * Math.min(1, value)} ${c}`} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray 500ms ease' }} />
      {done ? <path d="M28 39l7 7 13-15" fill="none" stroke="var(--color-fill-good)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : <text x="38" y="43" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--color-ink)">{Math.round(value * 100)}%</text>}
    </svg>
  );
}
