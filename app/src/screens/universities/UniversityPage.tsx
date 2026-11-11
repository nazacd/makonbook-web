import { ArrowUpRight, Bookmark, Check, ChevronLeft, CircleHelp, Globe2, MapPin, Minus, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useGoals, useSaveGoals } from '@/api/learning';
import { useMe } from '@/api/queries';
import { countryName, satMinimum, satRange, useUniversity, type UniversitySAT } from '@/api/universities';
import { fitOf, SAT_POLICY, useSaveUniversity, useSavedUniversities } from '@/api/universitySection';
import { UniversityBadge } from '@/components/onboarding/Crest';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useNow } from '@/lib/clock';
import { schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';
import { Flag } from '@/screens/roadmap/flags';

// The record's shape (makonbook-universities README 3.1 and 3.2), every part
// optional: most universities are only partly collected.
type Money = { amount?: number | null; min?: number | null; max?: number | null; currency?: string; usd?: number | null; usd_min?: number | null; usd_max?: number | null; year?: string | null; note?: string | null } | null;
type Record = {
  native_name?: string | null;
  type?: string | null;
  website?: string | null;
  admissions_url?: string | null;
  teaching_language?: string[] | null;
  english_bachelors?: 'all' | 'some' | 'none' | null;
  tuition?: Money;
  fees_extra?: Money;
  living_cost?: Money;
  region?: { name: string; note?: string } | null;
  location?: { lat: number; lng: number } | null;
  aid?: {
    need_based_international?: boolean | null;
    need_blind_international?: boolean | null;
    meets_full_need_international?: boolean | null;
    merit_scholarships_international?: boolean | null;
    scholarships?: { name: string; covers?: 'full' | 'tuition' | 'partial'; amount?: Money; url?: string }[];
    summary?: string | null;
  } | null;
  admissions?: {
    acceptance_rate?: { value: number; year?: string; scope?: string | null } | null;
    sat?: (UniversitySAT & { year?: string }) | null;
    act?: { policy?: string; p25?: number | null; p75?: number | null } | null;
    english?: { ielts?: { overall?: number | null; min_band?: number | null } | null; toefl_ibt?: { total?: number | null } | null; duolingo?: { total?: number | null } | null; note?: string | null } | null;
    interview?: string | null;
    application_system?: string | null;
    application_fee?: Money;
    deadlines?: { round: string; date: string; intake?: string }[];
  } | null;
  uzbek_students?: { count: number | string; year?: string } | null;
  sources?: { [path: string]: string };
  retrieved?: string;
};
type Country = {
  name?: string;
  currency?: string;
  study_visa?: { name?: string | null; official_url?: string | null; proof_of_funds?: Money; processing_days?: number | null; note?: string | null } | null;
  refusal_rate_uz?: { value: number; year?: string; visa_kind?: string } | null;
  work_rights?: { term_hours_per_week?: number | null; holidays_full_time?: boolean | null; note?: string | null; official_url?: string | null } | null;
  minimum_wage?: { hourly?: Money; note?: string | null } | null;
  post_study_work?: { name?: string; months?: number | null; official_url?: string | null } | null;
  retrieved?: string;
} | null;

const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/** A money object in dollars, with the local amount beside it: "$5,246 (CHF 4,380)". */
function money(m: Money | undefined, per = '', withLocal = true): string | null {
  if (!m) return null;
  const local = (n: number) => `${m.currency ?? ''} ${n.toLocaleString('en-US')}`.trim();
  if (m.amount === 0 || (m.usd === 0 && m.amount == null)) return 'Free';
  if (m.usd != null) return `${dollars(m.usd)}${per}${withLocal && m.currency && m.currency !== 'USD' && m.amount != null ? ` (${local(m.amount)})` : ''}`;
  if (m.usd_min != null && m.usd_max != null) return `${dollars(m.usd_min)}–${dollars(m.usd_max)}${per}${withLocal && m.currency && m.currency !== 'USD' && m.min != null && m.max != null ? ` (${local(m.min)}–${m.max.toLocaleString('en-US')})` : ''}`;
  if (m.amount != null) return local(m.amount) + per;
  return null;
}
const top = (m: Money | undefined) => (m ? (m.usd ?? m.usd_max ?? null) : null);

const ROUND: { [round: string]: string } = {
  early_decision: 'Early decision',
  early_action: 'Early action',
  regular: 'Regular decision',
  ucas_oxbridge: 'UCAS (Oxford, Cambridge, medicine)',
  ucas_main: 'UCAS main deadline',
  main: 'Application deadline',
};
const SYSTEM: { [s: string]: string } = { common_app: 'Common App', ucas: 'UCAS', coalition: 'Coalition', uni_assist: 'uni-assist', direct: 'On the university’s own site' };
const INTERVIEW: { [s: string]: string } = { required: 'Required', by_invitation: 'By invitation', optional: 'Optional', none: 'None' };
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// A university's page (spec 24.5): what the record holds, section by
// section, each fact as collected, "not collected yet" where it isn't.
export function UniversityPage() {
  const { id = '' } = useParams();
  const today = schoolDate(useNow());
  const me = useMe().data;
  const student = me?.kind === 'student';
  const query = useUniversity(id);
  const goals = useGoals(student);
  const saveGoals = useSaveGoals();
  const saved = useSavedUniversities(student);
  const save = useSaveUniversity();
  const u = query.data;
  useTitle(u?.name ?? 'University');

  const back = (
    <Link to="/universities" className="t-subhead -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <ChevronLeft size={18} aria-hidden="true" /> Universities
    </Link>
  );
  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        {back}
        <Skeleton height={220} radius={20} />
      </div>
    );
  }
  if (query.isError || !u) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        {back}
        {query.error instanceof ApiError && query.error.status === 404 ? <EmptyState icon={CircleHelp} title="No such university" message="It may have left the list." /> : <ErrorState title="Couldn’t load the university" message={describeError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      </div>
    );
  }

  const r = (u.details ?? {}) as Record;
  const c = (u.country_details ?? null) as Country;
  const a = r.admissions ?? {};
  const range = satRange(u.sat);
  const min = satMinimum(u.sat);
  const target = goals.data?.target_total ?? null;
  const fit = fitOf(target, u.sat, a.acceptance_rate?.value);
  const isSaved = (saved.data ?? []).includes(u.id);
  const isDream = goals.data?.university_id === u.id;
  const next = (a.deadlines ?? []).filter((d) => d.date >= today).sort((x, y) => x.date.localeCompare(y.date))[0];
  const place = [u.city, r.region?.name ?? countryName(u.country)].filter(Boolean).join(', ');
  const total = [top(r.tuition), top(r.fees_extra), top(r.living_cost)];
  const full = r.admissions_url != null && r.tuition != null;
  const where = r.region?.name ?? c?.name ?? countryName(u.country);

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      {back}
      <section className="uni-dream relative overflow-hidden rounded-panel p-5 text-white sm:p-7">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <UniversityBadge id={u.id} name={u.name} logo={u.logo_url} size={84} ring={isDream ? 'gold' : undefined} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-white/70">
              {u.qs && <span className="rounded-full bg-white/15 px-2 py-0.5 normal-case tracking-normal text-white">QS World #{u.qs.display.replace(/^=/, '')}</span>}
              {r.type && <span>{r.type}</span>}
              {isDream && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[#f5cf4a]">
                  <Star size={12} fill="currentColor" aria-hidden="true" /> Your dream university
                </span>
              )}
            </p>
            <h1 className="mt-1.5 text-[26px] font-bold leading-8 tracking-[-0.02em] sm:text-[32px] sm:leading-10">{u.name}</h1>
            {r.native_name && r.native_name !== u.name && <p className="t-subhead mt-0.5 text-white/70">{r.native_name}</p>}
            <p className="t-subhead mt-2 flex items-center gap-2 text-white/85">
              <Flag code={u.country} size={18} /> {place}
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {student && (
            <button type="button" onClick={() => save.mutate({ id: u.id, on: !isSaved })} aria-pressed={isSaved} className="inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[14px] font-bold text-[#1a0b3d]">
              <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" /> {isSaved ? 'On my list' : 'Save to my list'}
            </button>
          )}
          {student && !isDream && goals.data && (
            <button
              type="button"
              disabled={saveGoals.isPending}
              onClick={() => saveGoals.mutate({ target_math: goals.data!.target_math, target_rw: goals.data!.target_rw, exam_date: goals.data!.exam_date, university_id: u.id })}
              className="inline-flex h-10 items-center gap-2 rounded-control bg-white/15 px-4 text-[14px] font-bold text-white hover:bg-white/25">
              <Star size={16} aria-hidden="true" /> Make it my dream
            </button>
          )}
          {r.website && <External href={r.website}>Website</External>}
          {r.admissions_url && <External href={r.admissions_url}>Admissions for internationals</External>}
        </div>
      </section>

      {!full && (
        <p className="t-subhead mt-3 rounded-card border border-line bg-surface p-3.5 text-ink-2">
          Only the basics of this university are collected so far. Its costs, admissions and aid are being researched; until then, its own website is the place to check.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tuition a year" value={money(r.tuition, '', false)} note={r.tuition?.year ?? undefined} />
        <Tile label="Admitted" value={a.acceptance_rate ? `${Math.max(1, Math.round(a.acceptance_rate.value * 100))}%` : null} note={a.acceptance_rate?.year ? `of applicants, ${a.acceptance_rate.year}` : undefined} />
        <Tile label="SAT, admitted middle 50%" value={range ? `${range.p25}–${range.p75}` : min != null ? `${min}+ minimum` : u.sat && u.sat.policy !== 'unknown' ? SAT_POLICY[u.sat.policy] : null} note={u.sat && (range || min != null) ? SAT_POLICY[u.sat.policy] : undefined} />
        <Tile label="Next deadline" value={next ? day(next.date) : null} note={next ? (ROUND[next.round] ?? next.round) : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Admissions">
            <Rows>
              <Row label="SAT">{u.sat ? SAT_POLICY[u.sat.policy] : null}</Row>
              {range && <Row label="Admitted students’ SAT">{`${range.p25}–${range.p75} (middle 50%)`}</Row>}
              {min != null && <Row label="Published minimum">{String(min)}</Row>}
              {a.act?.p25 != null && a.act.p75 != null && <Row label="ACT, middle 50%">{`${a.act.p25}–${a.act.p75}`}</Row>}
              <Row label="English test">{english(a.english)}</Row>
              {a.english?.note && <Note>{a.english.note}</Note>}
              <Row label="Interview">{a.interview ? (INTERVIEW[a.interview] ?? a.interview) : null}</Row>
              <Row label="How to apply">{a.application_system ? (SYSTEM[a.application_system] ?? a.application_system) : null}</Row>
              <Row label="Application fee">{money(a.application_fee ?? null)}</Row>
              <Row label="Bachelor’s in English">{r.english_bachelors === 'all' ? 'Every programme' : r.english_bachelors === 'some' ? 'Some programmes' : r.english_bachelors === 'none' ? `None: taught in ${(r.teaching_language ?? []).map(langName).join(', ') || 'the local language'}` : null}</Row>
            </Rows>
            {(a.deadlines ?? []).length > 0 && (
              <div className="mt-4">
                <h3 className="t-subhead mb-1.5 font-semibold text-ink">Deadlines{a.deadlines![0]?.intake ? ` for ${intake(a.deadlines![0].intake)}` : ''}</h3>
                <ul className="flex flex-col gap-1.5">
                  {[...a.deadlines!].sort((x, y) => x.date.localeCompare(y.date)).map((d) => (
                    <li key={`${d.round}-${d.date}`} className={`flex items-center justify-between gap-3 rounded-control px-3 py-2 ${d.date < today ? 'bg-surface-2 text-ink-3' : 'bg-accent-tint text-ink'}`}>
                      <span className="t-subhead">{ROUND[d.round] ?? d.round}</span>
                      <span className="t-subhead tabular font-semibold">
                        {day(d.date)}
                        {d.date < today && ' · passed'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Costs">
            <Rows>
              <Row label="Tuition a year">{money(r.tuition)}</Row>
              {r.tuition?.note && <Note>{r.tuition.note}</Note>}
              {r.fees_extra && <Row label="Other fees">{money(r.fees_extra)}</Row>}
              <Row label="Living, the university’s estimate">{money(r.living_cost)}</Row>
              {r.living_cost?.note && <Note>{r.living_cost.note}</Note>}
              {total[0] != null && total[2] != null && <Row label="About a year in all" strong>{dollars(total.reduce<number>((s, n) => s + (n ?? 0), 0))}</Row>}
            </Rows>
          </Section>

          <Section title="Aid and scholarships">
            {r.aid?.summary && <p className="t-body mb-3 text-ink">{r.aid.summary}</p>}
            <Rows>
              <Row label="Need-based aid for internationals">{yesNo(r.aid?.need_based_international)}</Row>
              <Row label="Need-blind for internationals">{yesNo(r.aid?.need_blind_international)}</Row>
              <Row label="Meets full need">{yesNo(r.aid?.meets_full_need_international)}</Row>
              <Row label="Merit scholarships">{yesNo(r.aid?.merit_scholarships_international)}</Row>
            </Rows>
            {(r.aid?.scholarships ?? []).length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {r.aid!.scholarships!.map((s) => (
                  <li key={s.name} className="rounded-control border border-line p-3">
                    <p className="t-subhead font-semibold text-ink">{s.name}</p>
                    <p className="t-footnote text-ink-2">
                      {s.covers === 'full' ? 'Covers everything' : s.covers === 'tuition' ? 'Covers tuition' : 'Covers part'}
                      {s.amount && money(s.amount) ? ` · ${money(s.amount)}` : ''}
                    </p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="t-footnote mt-1 inline-flex items-center gap-0.5 font-semibold text-accent hover:underline">
                        Details <ArrowUpRight size={12} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          {student && (
            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="t-headline text-ink">Your SAT and theirs</h2>
              {range ? <ScoreBar range={range} target={target} /> : null}
              <p className="t-subhead mt-3 text-ink-2">
                {fit ? fit.note : !target ? 'Set your target score in your goals to see where it sits.' : min == null && !range ? 'This university hasn’t published its admitted students’ SAT scores.' : ''}
              </p>
            </section>
          )}

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="t-headline flex items-center gap-2 text-ink">
              <Flag code={u.country} size={18} /> Studying in {where}
            </h2>
            {r.region?.note && <p className="t-footnote mt-2 rounded-control bg-watch-tint p-2.5 text-ink">{r.region.note}</p>}
            {c && !r.region ? (
              <Rows compact>
                <Row label="Student visa">{c.study_visa?.name ?? null}</Row>
                <Row label="Money to show">{money(c.study_visa?.proof_of_funds ?? null, ' a year')}</Row>
                <Row label="Usual wait">{c.study_visa?.processing_days ? `${c.study_visa.processing_days} days` : null}</Row>
                <Row label="Refused, Uzbek applicants">{c.refusal_rate_uz ? `${Math.round(c.refusal_rate_uz.value * 100)}%${c.refusal_rate_uz.year ? ` (${c.refusal_rate_uz.year})` : ''}` : null}</Row>
                <Row label="Work during studies">{c.work_rights?.term_hours_per_week ? `${c.work_rights.term_hours_per_week} h a week in term` : c.work_rights?.note ? 'See the note' : null}</Row>
                <Row label="Minimum wage">{money(c.minimum_wage?.hourly ?? null, ' an hour')}</Row>
                <Row label="Work visa after graduating">{c.post_study_work ? `${c.post_study_work.name ?? 'Yes'}${c.post_study_work.months ? `, ${c.post_study_work.months} months` : ''}` : null}</Row>
              </Rows>
            ) : !r.region ? (
              <p className="t-subhead mt-2 text-ink-2">Visa facts for this country aren’t collected yet.</p>
            ) : null}
            {c?.study_visa?.note && !r.region && <Note>{c.study_visa.note}</Note>}
            {c?.work_rights?.note && !r.region && <Note>{c.work_rights.note}</Note>}
            {c?.study_visa?.official_url && !r.region && <External href={c.study_visa.official_url} light>The official visa page</External>}
          </section>

          {r.location && (
            <a href={`https://www.openstreetmap.org/?mlat=${r.location.lat}&mlon=${r.location.lng}#map=13/${r.location.lat}/${r.location.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:border-primary/40">
              <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-tint text-accent">
                <MapPin size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-headline block text-ink">On the map</span>
                <span className="t-footnote text-ink-2">{place}</span>
              </span>
              <ArrowUpRight size={16} className="text-ink-3" aria-hidden="true" />
            </a>
          )}
          {r.uzbek_students && (
            <p className="t-subhead rounded-card border border-line bg-surface p-4 text-ink">
              <span className="font-bold">{r.uzbek_students.count}</span> students from Uzbekistan study here{r.uzbek_students.year ? ` (${r.uzbek_students.year})` : ''}.
            </p>
          )}
        </aside>
      </div>

      {r.sources && Object.keys(r.sources).length > 0 && (
        <details className="mt-4 rounded-card border border-line bg-surface p-4">
          <summary className="t-subhead cursor-pointer font-semibold text-ink">
            <Globe2 size={15} className="mr-1.5 inline align-[-2px] text-ink-3" aria-hidden="true" />
            Where these facts come from{r.retrieved ? ` · collected ${day(r.retrieved)}` : ''}
          </summary>
          <ul className="t-footnote mt-3 grid gap-1 sm:grid-cols-2">
            {Object.entries(r.sources).map(([path, src]) => (
              <li key={path} className="flex min-w-0 gap-2">
                <span className="shrink-0 text-ink-3">{path}</span>
                {/^https?:/.test(src) ? (
                  <a href={src} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
                    {new URL(src).hostname.replace(/^www\./, '')}
                  </a>
                ) : (
                  <span className="text-ink-2">{src.toUpperCase()}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function langName(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function intake(s: string) {
  const [y, term] = s.split('-');
  return term ? `${term[0]!.toUpperCase()}${term.slice(1)} ${y}` : s;
}

function english(e: NonNullable<Record['admissions']>['english']): string | null {
  if (!e) return null;
  const parts = [e.ielts?.overall != null && `IELTS ${e.ielts.overall}${e.ielts.min_band != null ? ` (each part ${e.ielts.min_band})` : ''}`, e.toefl_ibt?.total != null && `TOEFL iBT ${e.toefl_ibt.total}`, e.duolingo?.total != null && `Duolingo ${e.duolingo.total}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : e.note ? 'See the note' : null;
}

function yesNo(v: boolean | null | undefined): ReactNode {
  if (v == null) return null;
  return v ? (
    <span className="inline-flex items-center gap-1 font-semibold text-good">
      <Check size={15} strokeWidth={2.6} aria-hidden="true" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-ink-2">
      <Minus size={15} aria-hidden="true" /> No
    </span>
  );
}

function External({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={light ? 't-subhead mt-3 inline-flex items-center gap-1 font-semibold text-accent hover:underline' : 'inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-[14px] font-bold text-white/90 hover:bg-white/15'}>
      {children} <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}

function Tile({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="t-footnote text-ink-2">{label}</p>
      {value ? <p className="t-number mt-1 text-[20px] leading-7 text-ink">{value}</p> : <p className="t-subhead mt-1.5 text-ink-3">Not collected yet</p>}
      {value && note && <p className="t-caption mt-0.5 text-ink-3">{note}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="t-title3 mb-3 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <dl className={`flex flex-col ${compact ? 'mt-2' : ''}`}>{children}</dl>;
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="t-subhead text-ink-2">{label}</dt>
      <dd className={`t-subhead text-right ${strong ? 'font-bold text-ink' : children ? 'font-medium text-ink' : 'text-ink-3'}`}>{children ?? 'Not collected yet'}</dd>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="t-footnote -mt-1 mb-1 pb-2 text-ink-3">{children}</p>;
}

/** The admitted middle 50 % on the 400–1600 scale, with the student's target on it. */
function ScoreBar({ range, target }: { range: { p25: number; p75: number }; target: number | null }) {
  // The scale starts a little below whichever is lower, so a narrow range still reads.
  const lo = Math.max(400, Math.floor((Math.min(range.p25, target ?? 1600) - 150) / 100) * 100);
  const pct = (n: number) => `${((Math.min(1600, Math.max(lo, n)) - lo) / (1600 - lo)) * 100}%`;
  return (
    <div className="mt-7" role="img" aria-label={`Admitted middle 50%: ${range.p25} to ${range.p75}${target ? `; your target ${target}` : ''}`}>
      <div className="relative h-3 rounded-full bg-track">
        <span className="absolute inset-y-0 rounded-full bg-primary/70" style={{ left: pct(range.p25), right: `calc(100% - ${pct(range.p75)})` }} />
        {target && (
          <span className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full bg-[#e8b923] shadow" style={{ left: pct(target) }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-ink">You {target}</span>
          </span>
        )}
      </div>
      <div className="t-caption relative mt-1.5 h-4 text-ink-3">
        <span className="absolute left-0">{lo}</span>
        <span className="tabular absolute -translate-x-1/2 font-semibold text-ink-2" style={{ left: `calc((${pct(range.p25)} + ${pct(range.p75)}) / 2)` }}>
          {range.p25}–{range.p75}
        </span>
        <span className="absolute right-0">1600</span>
      </div>
    </div>
  );
}
