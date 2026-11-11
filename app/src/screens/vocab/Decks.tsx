import { ChevronLeft, EyeOff, Globe2, Library, Lock, Plus, Search, ShieldAlert, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useCommunity, useDeckAction, useMyDecks, type UserDeck } from '@/api/vocabSocial';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Pill, Segmented } from '@/components/ui';
import { useTitle } from '@/lib/title';

type Tab = 'mine' | 'community';

// Decks (spec 11.6): the student's own decks and the ones they added, and
// the community's shared decks to look inside and add. Teachers get the
// community and, under Moderation, the decks hidden or reported.
export function Decks() {
  useTitle('Decks');
  const me = useMe().data;
  const teacher = me?.kind === 'teacher';
  const [params, setParams] = useSearchParams();
  const tab: Tab | 'moderation' = teacher ? (params.get('tab') === 'moderation' ? 'moderation' : 'community') : params.get('tab') === 'community' ? 'community' : 'mine';
  const setTab = (t: string) => setParams(t === (teacher ? 'community' : 'mine') ? {} : { tab: t }, { replace: true });

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <Link to="/words" className="t-subhead -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
        <ChevronLeft size={18} aria-hidden="true" /> Vocabulary
      </Link>
      <PageHeader
        icon={Library}
        title="Decks"
        subtitle={teacher ? 'Decks students made and shared.' : 'Your own words, and decks other students shared.'}
        actions={
          !teacher && (
            <Link to="/words/decks/new" className="lift inline-flex h-10 items-center gap-2 rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
              <Plus size={16} aria-hidden="true" /> Make a deck
            </Link>
          )
        }
      />
      <div className="mb-4">
        <Segmented
          label="Which decks"
          value={tab}
          onChange={setTab}
          options={
            teacher
              ? [
                  { value: 'community', label: 'Community' },
                  { value: 'moderation', label: 'To check' },
                ]
              : [
                  { value: 'mine', label: 'My decks' },
                  { value: 'community', label: 'Community' },
                ]
          }
        />
      </div>
      {tab === 'mine' ? <MyDecks /> : <Community moderation={tab === 'moderation'} teacher={teacher} />}
    </div>
  );
}

function MyDecks() {
  const decks = useMyDecks();
  if (decks.isPending && !decks.data) return <Grid loading />;
  if (decks.isError && !decks.data) return <ErrorState title="Couldn’t load your decks" message={describeError(decks.error)} onRetry={() => void decks.refetch()} retrying={decks.isFetching} />;
  const list = decks.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="No decks yet"
        message="Make one with words from your reading, or add a deck another student shared. Its words join your flashcards and games."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((d) => (
        <DeckCard key={d.id} deck={d} />
      ))}
    </ul>
  );
}

function Community({ moderation, teacher }: { moderation: boolean; teacher: boolean }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const decks = useCommunity(search, moderation);
  return (
    <>
      {!moderation && (
        <form
          className="relative mb-4 max-w-[420px]"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}>
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value === '') setSearch('');
            }}
            placeholder="Search decks"
            aria-label="Search decks"
            className="t-body h-11 w-full rounded-control border border-line bg-surface pl-10 pr-3 text-ink outline-none focus:border-primary"
          />
        </form>
      )}
      {decks.isPending ? (
        <Grid loading />
      ) : decks.isError ? (
        <ErrorState title="Couldn’t load the decks" message={describeError(decks.error)} onRetry={() => void decks.refetch()} retrying={decks.isFetching} />
      ) : decks.data.length === 0 ? (
        moderation ? (
          <EmptyState icon={ShieldAlert} title="Nothing to check" message="Decks students report, and decks you hid, show up here." />
        ) : (
          <EmptyState icon={Globe2} title={search ? 'No deck matches' : 'No shared decks yet'} message={search ? 'Try other words.' : teacher ? 'Decks appear here once students share them.' : 'Make a deck and share it: it could be the first.'} />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data.map((d) => (
            <DeckCard key={d.id} deck={d} community teacher={teacher} />
          ))}
        </ul>
      )}
    </>
  );
}

function Grid({ loading }: { loading: true }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={168} radius={16} />
      ))}
    </div>
  );
}

const HUES = ['#6d28d9', '#0e7490', '#be185d', '#c2410c', '#15803d', '#1d4ed8'];

/** A deck's colour, the same every time: from its id. */
export function deckHue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length]!;
}

/** A deck as a card: a coloured cover with its initial, its name, maker and counts, and the way in. */
export function DeckCard({ deck: d, community = false, teacher = false }: { deck: UserDeck; community?: boolean; teacher?: boolean }) {
  const action = useDeckAction();
  const hue = deckHue(d.id);
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <Link to={`/words/decks/${d.id}`} className="group flex flex-1 flex-col">
        <span className="relative flex h-[76px] items-end overflow-hidden px-4 pb-2" style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 55%, #000))` }}>
          <span className="pointer-events-none absolute -right-2 -top-6 select-none text-[96px] font-black leading-none text-white/15" aria-hidden="true">
            {d.title.trim()[0]?.toUpperCase()}
          </span>
          <span className="relative flex flex-wrap gap-1.5">
            {d.mine && !d.published && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white">
                <Lock size={11} aria-hidden="true" /> Private
              </span>
            )}
            {d.mine && d.published && !d.hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white">
                <Globe2 size={11} aria-hidden="true" /> Shared
              </span>
            )}
            {d.hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-bad">
                <EyeOff size={11} aria-hidden="true" /> Hidden
              </span>
            )}
            {d.added && !community && <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white">Added</span>}
          </span>
        </span>
        <span className="flex flex-1 flex-col px-4 pb-3 pt-3">
          <span className="t-headline line-clamp-2 text-ink group-hover:text-accent">{d.title}</span>
          {d.description && <span className="t-footnote mt-0.5 line-clamp-2 text-ink-2">{d.description}</span>}
          <span className="t-footnote mt-auto flex flex-wrap items-center gap-x-2 pt-2 text-ink-3">
            <span>{d.word_count} words</span>·<span>{d.mine ? 'by you' : `by ${d.owner}`}</span>
            {d.published && (
              <>
                ·
                <span className="inline-flex items-center gap-1">
                  <Users size={12} aria-hidden="true" /> {d.adds}
                </span>
              </>
            )}
          </span>
        </span>
      </Link>
      {community && !teacher && !d.mine && (
        <div className="border-t border-line px-4 py-2.5">
          <button
            type="button"
            disabled={action.isPending}
            onClick={() => action.mutate({ id: d.id, action: d.added ? 'remove' : 'add' })}
            className={`t-subhead inline-flex h-9 items-center gap-1.5 rounded-control px-3 font-bold ${d.added ? 'bg-surface-2 text-ink-2' : 'bg-accent-tint text-accent hover:bg-primary hover:text-on-primary'}`}>
            {d.added ? 'Added to your decks' : <><Plus size={15} aria-hidden="true" /> Add to my decks</>}
          </button>
        </div>
      )}
      {teacher && d.reports != null && d.reports > 0 && (
        <div className="border-t border-line px-4 py-2.5">
          <Pill tone="bad">
            {d.reports} {d.reports === 1 ? 'report' : 'reports'}
          </Pill>
        </div>
      )}
    </li>
  );
}
