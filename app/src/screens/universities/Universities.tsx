import { ArrowRight, Bookmark, Check as CheckIcon, GraduationCap, Search, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useGoals } from '@/api/learning';
import { useMe } from '@/api/queries';
import { countryName, satRange, useUniversities, type University } from '@/api/universities';
import { CONTINENTS, continentOf, fitOf, SAT_POLICY, usd, useSaveUniversity, useSavedUniversities, type Continent } from '@/api/universitySection';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Modal, PageHeader, Segmented } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { Flag } from '@/screens/roadmap/flags';

type Sort = 'rank' | 'cheapest' | 'hardest' | 'easiest' | 'deadline' | 'name';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'rank', label: 'Best ranked' },
  { value: 'cheapest', label: 'Cheapest first' },
  { value: 'hardest', label: 'Hardest to get in' },
  { value: 'easiest', label: 'Easiest to get in' },
  { value: 'deadline', label: 'Deadline soonest' },
  { value: 'name', label: 'Name A–Z' },
];
const BUDGETS = [
  { value: '', label: 'Any cost' },
  { value: '0', label: 'Free tuition' },
  { value: '10000', label: 'Under $10,000' },
  { value: '25000', label: 'Under $25,000' },
  { value: '50000', label: 'Under $50,000' },
];
const PAGE = 60;

// Check filters, by group: each a test on a university.
type Toggle = { key: string; label: string; test: (u: University) => boolean };
const MONEY: Toggle[] = [
  {
    key: 'aid',
    label: 'Need-based aid',
    test: (u) => !!u.facts?.aid.need_based,
  },
  {
    key: 'scholarships',
    label: 'Scholarships',
    test: (u) => (u.facts?.aid.scholarships ?? 0) > 0 || !!u.facts?.aid.merit,
  },
];
const ADMISSIONS: Toggle[] = [
  {
    key: 'sat',
    label: 'Takes the SAT',
    test: (u) => ['required', 'optional', 'accepted'].includes(u.sat?.policy ?? ''),
  },
  {
    key: 'english',
    label: 'Bachelor’s in English',
    test: (u) => u.facts?.english_bachelors === 'all' || u.facts?.english_bachelors === 'some',
  },
];
const FULL: Toggle = {
  key: 'full',
  label: 'Full profiles only',
  test: (u) => !!u.facts?.full,
};
const TOGGLES = [...MONEY, ...ADMISSIONS, FULL];
const TYPES = [
  { value: '', label: 'Any' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

// The university section (spec 24.5): every listed university with search,
// filters and sorts kept in the address (so Back returns to the same view),
// and the student's own list. Facts that weren't collected are left out of
// a filter's matches, never guessed.
export function Universities() {
  useTitle('Universities');
  const today = schoolDate(useNow());
  const me = useMe().data;
  const student = me?.kind === 'student';
  const list = useUniversities();
  const goals = useGoals(student);
  const saved = useSavedUniversities(student);
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as Sort | null) ?? 'rank';
  const continent = (params.get('continent') as Continent | null) ?? null;
  const country = params.get('country');
  const budget = params.get('budget') ?? '';
  const type = params.get('type') ?? '';
  const on = new Set((params.get('only') ?? '').split(',').filter(Boolean));
  const tab = params.get('tab') === 'saved' ? 'saved' : 'all';
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
    setShown(PAGE);
  };
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    set({ only: [...next].join(',') });
  };

  const all = useMemo(() => list.data ?? [], [list.data]);
  const savedIds = useMemo(() => saved.data ?? [], [saved.data]);
  const savedSet = new Set(savedIds);
  const dream = goals.data?.university_id ?? null;
  const target = goals.data?.target_total ?? null;

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of all) if (!continent || continentOf(u.country) === continent) counts.set(u.country, (counts.get(u.country) ?? 0) + 1);
    return [...counts].map(([code, n]) => ({ code, n, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, continent]);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let out = tab === 'saved' ? savedIds.map((id) => all.find((u) => u.id === id)).filter((u): u is University => !!u) : all;
    out = out.filter((u) => {
      if (continent && continentOf(u.country) !== continent) return false;
      if (country && u.country !== country) return false;
      if (budget) {
        const t = u.facts?.tuition;
        if (!t || t.min > Number(budget) || (budget === '0' && t.max !== 0)) return false;
      }
      if (type && u.facts?.type !== type) return false;
      for (const t of TOGGLES) if (on.has(t.key) && !t.test(u)) return false;
      if (words.length) {
        const hay = `${u.name} ${u.short_name ?? ''} ${u.city ?? ''} ${countryName(u.country)}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const last = (n: number | null | undefined) => n ?? Number.POSITIVE_INFINITY;
    const next = (u: University) => u.facts?.deadlines.find((d) => d >= today) ?? null;
    const by: Record<Sort, (a: University, b: University) => number> = {
      rank: (a, b) => last(a.qs?.rank) - last(b.qs?.rank),
      cheapest: (a, b) => last(a.facts?.tuition?.min) - last(b.facts?.tuition?.min),
      hardest: (a, b) => last(a.facts?.acceptance_rate) - last(b.facts?.acceptance_rate),
      easiest: (a, b) => (b.facts?.acceptance_rate ?? -1) - (a.facts?.acceptance_rate ?? -1),
      deadline: (a, b) => (next(a) ?? '9999').localeCompare(next(b) ?? '9999'),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return tab === 'saved' && sort === 'rank' ? out : [...out].sort((a, b) => by[sort](a, b) || last(a.qs?.rank) - last(b.qs?.rank));
    // `on` is rebuilt from params each render; params is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, savedIds, tab, q, continent, country, budget, type, params, sort, today]);

  const filters = (continent ? 1 : 0) + (country ? 1 : 0) + (budget ? 1 : 0) + (type ? 1 : 0) + on.size;
  const clearAll = () =>
    set({
      continent: null,
      country: null,
      budget: null,
      type: null,
      only: null,
    });
  // What each check would leave, among what the other filters leave.
  const countIf = (t: Toggle) => (on.has(t.key) ? results.length : results.filter(t.test).length);
  const chips: { label: string; clear: () => void }[] = [
    ...(continent
      ? [
          {
            label: continent,
            clear: () => set({ continent: null, country: null }),
          },
        ]
      : []),
    ...(country ? [{ label: countryName(country), clear: () => set({ country: null }) }] : []),
    ...(budget
      ? [
          {
            label: BUDGETS.find((x) => x.value === budget)?.label ?? budget,
            clear: () => set({ budget: null }),
          },
        ]
      : []),
    ...(type
      ? [
          {
            label: type === 'public' ? 'Public' : 'Private',
            clear: () => set({ type: null }),
          },
        ]
      : []),
    ...TOGGLES.filter((t) => on.has(t.key)).map((t) => ({
      label: t.label,
      clear: () => toggle(t.key),
    })),
  ];
  const panel = <FilterPanel continent={continent} country={country} countries={countries} budget={budget} type={type} on={on} countIf={countIf} onSet={set} onToggle={toggle} />;
  const dreamU = dream ? all.find((u) => u.id === dream) : undefined;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader
        icon={GraduationCap}
        title="Universities"
        subtitle={list.data ? `${all.length.toLocaleString('en-US')} universities: costs, admissions and visas, each with its source.` : 'Costs, admissions and visas, each with its source.'}
        actions={
          student ? (
            <Segmented
              label="Which universities"
              value={tab}
              onChange={(v) => set({ tab: v === 'saved' ? 'saved' : null })}
              options={[
                { value: 'all', label: 'All' },
                { value: 'saved', label: 'My list', count: savedIds.length },
              ]}
            />
          ) : undefined
        }
      />

      {dreamU && tab === 'all' && (
        <Link to={`/universities/${dreamU.id}`} className="uni-dream mb-4 flex items-center gap-4 rounded-panel p-4 text-white sm:p-5">
          <UniversityBadge id={dreamU.id} name={dreamU.name} logo={dreamU.logo_url} size={52} ring="gold" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[#f5cf4a]">
              <Star size={13} fill="currentColor" aria-hidden="true" /> Your dream university
            </span>
            <span className="t-headline block truncate">{dreamU.name}</span>
            <span className="t-footnote text-white/70">{[dreamU.city, countryName(dreamU.country)].filter(Boolean).join(', ')}</span>
          </span>
          <ArrowRight size={18} aria-hidden="true" className="shrink-0" />
        </Link>
      )}

      <div className="mb-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search a university, city or country"
            aria-label="Search universities"
            className="t-body h-11 w-full rounded-control border border-line bg-surface pl-10 pr-3 text-ink outline-none focus:border-primary"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'rank' ? null : e.target.value })}
          aria-label="Sort"
          className="t-subhead hidden h-11 rounded-control border border-line bg-surface pl-3 font-semibold text-ink sm:block">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="t-subhead relative inline-flex h-11 shrink-0 items-center gap-2 rounded-control border border-line bg-surface px-3.5 font-semibold text-ink hover:bg-surface-2 lg:hidden">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Filters</span>
          {filters > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary">{filters}</span>}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              aria-label={`Remove filter: ${c.label}`}
              className="t-footnote inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-tint pl-3 pr-2 font-semibold text-accent hover:bg-primary hover:text-on-primary">
              {c.label} <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="t-footnote inline-flex h-8 shrink-0 items-center rounded-full px-2 font-semibold text-ink-2 hover:text-ink">
            Clear all
          </button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <aside className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-card border border-line bg-surface p-4 lg:block" aria-label="Filters">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="t-headline text-ink">Filters</h2>
            {filters > 0 && (
              <button type="button" onClick={clearAll} className="t-footnote font-semibold text-accent hover:underline">
                Clear all
              </button>
            )}
          </div>
          {panel}
        </aside>
        <div className="min-w-0">
          {list.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height={210} radius={16} />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState title="Couldn’t load the universities" message={describeError(list.error)} onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : results.length === 0 ? (
            tab === 'saved' && savedIds.length === 0 ? (
              <EmptyState icon={Bookmark} title="Your list is empty" message="Save universities you’re thinking about: they’ll be here to compare and come back to." />
            ) : (
              <EmptyState icon={Search} title="No university matches" message={filters ? 'Try fewer filters. Universities whose figures weren’t collected yet don’t match a filter on them.' : 'Try other words.'} />
            )
          ) : (
            <>
              <p className="t-footnote mb-2.5 text-ink-2">
                {results.length.toLocaleString('en-US')} {results.length === 1 ? 'university' : 'universities'}
                {(budget || type || on.size > 0) && ' · only those whose figures were collected'}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.slice(0, shown).map((u) => (
                  <UniCard key={u.id} u={u} saved={savedSet.has(u.id)} dream={u.id === dream} target={target} student={student} today={today} />
                ))}
              </ul>
              {results.length > shown && (
                <div className="mt-5 flex justify-center">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)} className="t-subhead h-11 rounded-control border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-surface-2">
                    Show more ({(results.length - shown).toLocaleString('en-US')} left)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filtersOpen && (
        <Modal
          title="Filters"
          onClose={() => setFiltersOpen(false)}
          width={480}
          footer={
            <div className="flex w-full items-center gap-3">
              <button type="button" onClick={clearAll} disabled={filters === 0} className="t-subhead h-11 rounded-control px-3 font-semibold text-ink-2 hover:text-ink disabled:opacity-40">
                Clear all
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="lift t-headline h-11 flex-1 rounded-control bg-primary px-4 text-on-primary">
                Show {results.length.toLocaleString('en-US')} {results.length === 1 ? 'university' : 'universities'}
              </button>
            </div>
          }>
          <div className="mb-1 sm:hidden">
            <p className="t-micro mb-2 text-ink-3">Sort by</p>
            <select value={sort} onChange={(e) => set({ sort: e.target.value === 'rank' ? null : e.target.value })} aria-label="Sort" className="t-body h-11 w-full rounded-control border border-line bg-surface pl-3 text-ink">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {panel}
        </Modal>
      )}
    </div>
  );
}

/** The filters, in groups; the same on laptops (a column) and phones (a sheet). */
function FilterPanel({
  continent,
  country,
  countries,
  budget,
  type,
  on,
  countIf,
  onSet,
  onToggle,
}: {
  continent: Continent | null;
  country: string | null;
  countries: { code: string; n: number; name: string }[];
  budget: string;
  type: string;
  on: Set<string>;
  countIf: (t: Toggle) => number;
  onSet: (changes: Record<string, string | null>) => void;
  onToggle: (key: string) => void;
}) {
  const field = 't-subhead h-10 w-full rounded-control border bg-surface pl-3 text-ink';
  return (
    <div className="flex flex-col">
      <Group title="Where">
        <select value={continent ?? ''} onChange={(e) => onSet({ continent: e.target.value || null, country: null })} aria-label="Continent" className={`${field} ${continent ? 'border-primary' : 'border-line'}`}>
          <option value="">All continents</option>
          {CONTINENTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={country ?? ''} onChange={(e) => onSet({ country: e.target.value || null })} aria-label="Country" className={`${field} mt-2 ${country ? 'border-primary' : 'border-line'}`}>
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.n})
            </option>
          ))}
        </select>
      </Group>
      <Group title="Tuition a year">
        <div role="radiogroup" aria-label="Tuition a year" className="flex flex-col gap-0.5">
          {BUDGETS.map((b) => {
            const sel = budget === b.value;
            return (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => onSet({ budget: b.value || null })}
                className="t-subhead flex h-9 items-center gap-2.5 rounded-control px-1.5 text-left text-ink hover:bg-surface-2">
                <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${sel ? 'border-primary' : 'border-line-strong'}`}>{sel && <span className="size-2 rounded-full bg-primary" />}</span>
                <span className={sel ? 'font-semibold' : ''}>{b.label}</span>
              </button>
            );
          })}
        </div>
      </Group>
      <Group title="Money help">
        {MONEY.map((t) => (
          <Check key={t.key} label={t.label} checked={on.has(t.key)} count={countIf(t)} onChange={() => onToggle(t.key)} />
        ))}
      </Group>
      <Group title="Admissions">
        {ADMISSIONS.map((t) => (
          <Check key={t.key} label={t.label} checked={on.has(t.key)} count={countIf(t)} onChange={() => onToggle(t.key)} />
        ))}
      </Group>
      <Group title="Type">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-control bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => onSet({ type: t.value || null })}
              className={`t-footnote h-8 rounded-[9px] font-semibold ${type === t.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Profile" last>
        <Check label={FULL.label} checked={on.has(FULL.key)} count={countIf(FULL)} onChange={() => onToggle(FULL.key)} />
        <p className="t-caption mt-1 px-1.5 text-ink-3">Costs, admissions and aid researched in full. The rest have their basics so far.</p>
      </Group>
    </div>
  );
}

function Group({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
  return (
    <section className={`py-3.5 ${last ? '' : 'border-b border-line'}`}>
      <h3 className="t-micro mb-2 text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/** A check row with how many universities it would leave. */
function Check({ label, checked, count, onChange }: { label: string; checked: boolean; count: number; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange} className="t-subhead flex h-9 w-full items-center gap-2.5 rounded-control px-1.5 text-left text-ink hover:bg-surface-2">
      <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 ${checked ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'}`}>
        {checked && <CheckIcon size={12} strokeWidth={3.5} aria-hidden="true" />}
      </span>
      <span className={`flex-1 ${checked ? 'font-semibold' : ''}`}>{label}</span>
      <span className="t-footnote tabular text-ink-3">{count.toLocaleString('en-US')}</span>
    </button>
  );
}

const TONE = {
  good: 'bg-good-tint text-good',
  watch: 'bg-watch-tint text-watch',
  bad: 'bg-bad-tint text-bad',
};

/** A university as a card: badge, rank, name and place, cost, aid, admission, and the way to save it. */
function UniCard({ u, saved, dream, target, student, today }: { u: University; saved: boolean; dream: boolean; target: number | null; student: boolean; today: string }) {
  const save = useSaveUniversity();
  const f = u.facts;
  const cost = usd(f?.tuition);
  const fit = fitOf(target, u.sat, f?.acceptance_rate);
  const range = satRange(u.sat);
  const next = f?.deadlines.find((d) => d >= today);
  const aid = f?.aid.full_need
    ? 'Meets full need'
    : f?.aid.need_based
      ? 'Need-based aid'
      : (f?.aid.scholarships ?? 0) > 0
        ? `${f!.aid.scholarships} ${f!.aid.scholarships === 1 ? 'scholarship' : 'scholarships'}`
        : f?.aid.merit
          ? 'Merit scholarships'
          : null;
  return (
    <li className="relative">
      <Link to={`/universities/${u.id}`} className="group flex h-full flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-primary/40">
        <span className="flex items-start gap-3 pr-9">
          <UniversityBadge id={u.id} name={u.name} logo={u.logo_url} size={48} ring={dream ? 'gold' : undefined} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              {u.qs && <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-bold text-accent">QS #{u.qs.display.replace(/^=/, '')}</span>}
              {dream && (
                <span className="inline-flex items-center gap-1 rounded-full bg-watch-tint px-2 py-0.5 text-[11px] font-bold text-watch">
                  <Star size={10} fill="currentColor" aria-hidden="true" /> Dream
                </span>
              )}
              {f?.full && (
                <span className="inline-flex items-center gap-1 rounded-full bg-good-tint px-2 py-0.5 text-[11px] font-bold text-good">
                  <Sparkles size={10} aria-hidden="true" /> Full profile
                </span>
              )}
            </span>
            <span className="t-headline mt-1 line-clamp-2 block text-ink group-hover:text-accent">{u.name}</span>
            <span className="t-footnote mt-0.5 flex items-start gap-1.5 text-ink-2">
              <Flag code={u.country} size={14} className="mt-[3px] shrink-0" />
              <span>{[u.city, f?.region ?? countryName(u.country)].filter(Boolean).join(', ')}</span>
            </span>
          </span>
        </span>
        <span className="mt-3 flex items-baseline gap-1.5">
          {cost ? (
            <>
              <span className="t-number text-[22px] leading-7 text-ink">{cost}</span>
              {cost !== 'Free' && <span className="t-footnote text-ink-3">a year</span>}
              {cost === 'Free' && <span className="t-footnote text-ink-3">tuition</span>}
            </>
          ) : (
            <span className="t-footnote text-ink-3">Cost not collected yet</span>
          )}
        </span>
        <span className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {aid && <Chip className="bg-good-tint text-good">{aid}</Chip>}
          {f?.acceptance_rate != null && <Chip className="bg-surface-2 text-ink-2">{Math.max(1, Math.round(f.acceptance_rate * 100))}% admitted</Chip>}
          {range ? (
            <Chip className="bg-surface-2 text-ink-2">
              SAT {range.p25}–{range.p75}
            </Chip>
          ) : (
            u.sat && u.sat.policy !== 'unknown' && <Chip className="bg-surface-2 text-ink-2">{SAT_POLICY[u.sat.policy]}</Chip>
          )}
          {fit && <Chip className={TONE[fit.tone]}>{fit.label}</Chip>}
          {next && (
            <Chip className="bg-surface-2 text-ink-2">
              Apply by{' '}
              {new Date(`${next}T00:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </Chip>
          )}
        </span>
      </Link>
      {student && (
        <button
          type="button"
          onClick={() => save.mutate({ id: u.id, on: !saved })}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${u.name} from my list` : `Save ${u.name} to my list`}
          className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full ${saved ? 'bg-accent-tint text-accent' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}>
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function Chip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-[12px] font-semibold ${className}`}>{children}</span>;
}
