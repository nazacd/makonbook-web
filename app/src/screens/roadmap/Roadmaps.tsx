import { ArrowRight, BookOpenCheck, Check, MapPin, Signpost, Target, Users } from 'lucide-react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useRoadmaps, type RoadmapSummary } from '@/api/roadmaps';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { PageHeader, Pill, Progress } from '@/components/ui';
import { useTitle } from '@/lib/title';

import { Flagless } from './flags';

// "/roadmaps": the student's journeys, one card per course. A free account
// that hasn't done onboarding is offered it first; it builds their roadmap.
export function Roadmaps() {
  useTitle('Roadmaps');
  const me = useMe().data;
  const needsOnboarding = me?.status === 'registered' && me.onboarded === false;
  const list = useRoadmaps(!needsOnboarding);

  if (needsOnboarding) return <Unlock />;
  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <PageHeader
        icon={Signpost}
        title="Your roadmaps"
        subtitle="Pick a course and continue the journey."
        actions={list.data && list.data.length > 0 ? <Pill tone="primary">{list.data.length === 1 ? '1 roadmap' : `${list.data.length} roadmaps`}</Pill> : undefined}
      />
      {list.isPending ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          <Skeleton height={176} radius={16} />
          <Skeleton height={176} radius={16} />
        </div>
      ) : list.isError ? (
        <Notice tone="error" message={describeError(list.error)} />
      ) : list.data.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center">
          <Flagless />
          <p className="t-headline mt-3 text-ink">No roadmap yet</p>
          <p className="t-subhead mx-auto mt-1 max-w-md text-ink-2">
            {me?.kind === 'teacher' ? 'Roadmaps are for students.' : 'Your roadmap appears here once you’re in a Math or English group at SATMAKON.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {list.data.map((r) => (
            <RoadmapCard key={r.id} r={r} />
          ))}
        </div>
      )}
      {me?.status === 'registered' && list.data && list.data.length > 0 && (
        <p className="t-footnote mt-4 text-ink-3">
          Want a different level or subject?{' '}
          <Link to="/onboarding" className="font-bold text-accent hover:underline">
            Answer the questions again
          </Link>
          . Your progress stays.
        </p>
      )}
    </div>
  );
}

function RoadmapCard({ r }: { r: RoadmapSummary }) {
  const pct = r.lessons_total ? Math.round((100 * r.lessons_done) / r.lessons_total) : 0;
  return (
    <Link to={`/roadmaps/${r.id}`} className="group rounded-card border border-line bg-surface p-[18px] transition-colors hover:bg-surface-2">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-primary">
          <Signpost size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-headline truncate text-ink">{r.title}</p>
          <p className="t-footnote truncate text-ink-2">{r.group_name ?? 'Your personal roadmap'}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill tone="primary">{r.subject === 'math' ? 'Math' : 'English'}</Pill>
        {r.free_units != null && <Pill tone="neutral">Free: first {r.free_units} stops</Pill>}
      </div>
      <p className="t-footnote mt-3 flex items-center gap-1.5 text-ink-2">
        {r.current ? (
          <>
            <MapPin size={14} className="shrink-0 text-primary" aria-hidden="true" />
            Current stop: <span className="truncate font-semibold text-primary">{r.current.unit_title}</span>
          </>
        ) : (
          <>
            <Check size={14} className="shrink-0 text-good" aria-hidden="true" /> {r.lessons_done === r.lessons_total ? 'Journey complete' : 'Enrol to continue the journey'}
          </>
        )}
      </p>
      <div className="mt-3 flex items-center justify-between text-[12.5px] text-ink-2">
        <span>
          {r.lessons_done}/{r.lessons_total} lessons
        </span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <Progress value={pct} className="mt-1.5" />
    </Link>
  );
}

/** A free account before onboarding: what the roadmap gives, and the way in. */
function Unlock() {
  return (
    <div className="mx-auto w-full max-w-[640px] py-6">
      <div className="rise flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-[18px] bg-primary text-on-primary">
          <Signpost size={30} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[28px] font-semibold leading-9 tracking-[-0.02em] text-title">Unlock your roadmap</h1>
        <p className="t-subhead mt-1.5 max-w-md text-ink-2">Answer a few questions about your SAT and we’ll build your journey, lesson by lesson. It takes about two minutes.</p>
      </div>
      <ul className="mt-6 flex flex-col gap-2.5 rounded-card border border-line bg-surface p-5">
        {[
          { icon: Signpost, text: 'A study roadmap for Math and English at your level' },
          { icon: BookOpenCheck, text: 'Lessons with level checks and homework, one stop at a time' },
          { icon: Target, text: 'Your target score saved to your profile' },
          { icon: Users, text: 'The first country free; SATMAKON students get the whole journey' },
        ].map((x) => (
          <li key={x.text} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent-tint text-primary">
              <x.icon size={16} aria-hidden="true" />
            </span>
            <span className="t-subhead text-ink">{x.text}</span>
          </li>
        ))}
      </ul>
      <Link to="/onboarding" className="lift mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-bold text-on-primary hover:bg-primary-hover">
        Start <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
