import { ArrowRight, Bookmark, GraduationCap, Search, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useGoals } from '@/api/learning';
import { useMe } from '@/api/queries';
import { countryName, satRange, useUniversities, type University } from '@/api/universities';
import { CONTINENTS, continentOf, fitOf, SAT_POLICY, usd, useSaveUniversity, useSavedUniversities, type Continent } from '@/api/universitySection';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Segmented } from '@/components/ui';
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

// Toggle filters: each a test on a university.
const TOGGLES: { key: string; label: string; test: (u: University) => boolean }[] = [
  { key: 'aid', label: 'Need-based aid', test: (u) => !!u.facts?.aid.need_based },
  { key: 'scholarships', label: 'Scholarships', test: (u) => (u.facts?.aid.scholarships ?? 0) > 0 || !!u.facts?.aid.merit },
  { key: 'sat', label: 'Takes the SAT', test: (u) => ['required', 'optional', 'accepted'].includes(u.sat?.policy ?? '') },
  { key: 'english', label: 'Bachelor’s in English', test: (u) => u.facts?.english_bachelors === 'all' || u.facts?.english_bachelors === 'some' },
  { key: 'public', label: 'Public', test: (u) => u.facts?.type === 'public' },
  { key: 'private', label: 'Private', test: (u) => u.facts?.type === 'private' },
  { key: 'full', label: 'Full profiles', test: (u) => !!u.facts?.full },
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
  }, [all, savedIds, tab, q, continent, country, budget, params, sort, today]);

  const filters = (continent ? 1 : 0) + (country ? 1 : 0) + (budget ? 1 : 0) + on.size;
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

      <section className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-brand/95 px-4 pb-3 pt-2 backdrop-blur md:static md:mx-0 md:rounded-card md:border md:bg-surface md:p-3">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Search a university, city or country" aria-label="Search universities" className="t-body h-11 w-full rounded-control border border-line bg-surface pl-10 pr-3 text-ink outline-none focus:border-primary" />
          </label>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === 'rank' ? null : e.target.value })} aria-label="Sort" className="t-subhead hidden h-11 rounded-control border border-line bg-surface px-3 font-semibold text-ink sm:block">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="t-subhead inline-flex h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 font-semibold text-ink md:hidden">
            <SlidersHorizontal size={16} aria-hidden="true" /> {filters ? filters : ''}
          </button>
        </div>
        <div className={`${filtersOpen ? 'flex' : 'hidden'} mt-2.5 flex-wrap items-center gap-2 md:flex`}>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === 'rank' ? null : e.target.value })} aria-label="Sort" className="t-subhead h-9 rounded-full border border-line bg-surface px-3 font-semibold text-ink sm:hidden">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Picker value={continent ?? ''} onChange={(v) => set({ continent: v || null, country: null })} label="Continent" active={!!continent}>
            <option value="">All continents</option>
            {CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Picker>
          <Picker value={country ?? ''} onChange={(v) => set({ country: v || null })} label="Country" active={!!country}>
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.n})
              </option>
            ))}
          </Picker>
          <Picker value={budget} onChange={(v) => set({ budget: v || null })} label="Tuition a year" active={!!budget}>
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Picker>
          {TOGGLES.map((t) => (
            <button key={t.key} type="button" aria-pressed={on.has(t.key)} onClick={() => toggle(t.key)} className={`t-subhead h-9 rounded-full border px-3 font-semibold transition-colors ${on.has(t.key) ? 'border-primary bg-accent-tint text-accent' : 'border-line bg-surface text-ink-2 hover:border-line-strong'}`}>
              {t.label}
            </button>
          ))}
          {filters > 0 && (
            <button type="button" onClick={() => set({ continent: null, country: null, budget: null, only: null })} className="t-subhead inline-flex h-9 items-center gap-1 rounded-full px-3 font-semibold text-accent hover:bg-accent-tint">
              <X size={14} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </section>

      {list.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            {(budget || on.size > 0) && ' · only those whose figures were collected'}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

function Picker({ value, onChange, label, active, children }: { value: string; onChange: (v: string) => void; label: string; active: boolean; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`t-subhead h-9 max-w-[200px] rounded-full border px-3 font-semibold ${active ? 'border-primary bg-accent-tint text-accent' : 'border-line bg-surface text-ink-2'}`}>
      {children}
    </select>
  );
}

const TONE = { good: 'bg-good-tint text-good', watch: 'bg-watch-tint text-watch', bad: 'bg-bad-tint text-bad' };

/** A university as a card: badge, rank, name and place, cost, aid, admission, and the way to save it. */
function UniCard({ u, saved, dream, target, student, today }: { u: University; saved: boolean; dream: boolean; target: number | null; student: boolean; today: string }) {
  const save = useSaveUniversity();
  const f = u.facts;
  const cost = usd(f?.tuition);
  const fit = fitOf(target, u.sat, f?.acceptance_rate);
  const range = satRange(u.sat);
  const next = f?.deadlines.find((d) => d >= today);
  const aid = f?.aid.full_need ? 'Meets full need' : f?.aid.need_based ? 'Need-based aid' : (f?.aid.scholarships ?? 0) > 0 ? `${f!.aid.scholarships} ${f!.aid.scholarships === 1 ? 'scholarship' : 'scholarships'}` : f?.aid.merit ? 'Merit scholarships' : null;
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
            <span className="t-footnote mt-0.5 flex items-center gap-1.5 text-ink-2">
              <Flag code={u.country} size={14} />
              <span className="truncate">{[u.city, f?.region ?? countryName(u.country)].filter(Boolean).join(', ')}</span>
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
          {range ? <Chip className="bg-surface-2 text-ink-2">SAT {range.p25}–{range.p75}</Chip> : u.sat && u.sat.policy !== 'unknown' && <Chip className="bg-surface-2 text-ink-2">{SAT_POLICY[u.sat.policy]}</Chip>}
          {fit && <Chip className={TONE[fit.tone]}>{fit.label}</Chip>}
          {next && <Chip className="bg-surface-2 text-ink-2">Apply by {new Date(`${next}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</Chip>}
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
