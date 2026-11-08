import { ArrowLeft, Check, ChevronRight, Clock, Lock, MapPin, PlayCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { describeError } from '@/api/errors';
import { useRoadmap, type RoadmapLesson } from '@/api/roadmaps';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { Pill, Progress } from '@/components/ui';
import { useTitle } from '@/lib/title';

import { Flag } from './flags';
import { Medallion } from './RoadmapMap';

// A stop on the journey (a unit): its university and the lessons there, in
// order, each with its level check and homework progress.
export function RoadmapUnit() {
  const { id = '', unitId = '' } = useParams();
  const roadmap = useRoadmap(id);
  const r = roadmap.data;
  const unit = r?.units.find((u) => u.id === unitId);
  const countryIndex = r ? r.countries.findIndex((c) => c.units.includes(unitId)) : -1;
  const country = r?.countries[countryIndex];
  useTitle(unit?.title ?? 'Roadmap');

  if (roadmap.isPending) return <Skeleton className="mx-auto h-[420px] max-w-[880px] rounded-card" />;
  if (roadmap.isError) return <Notice tone="error" message={describeError(roadmap.error)} />;
  if (!unit || !r) return <Notice tone="error" message="This stop isn’t on your roadmap." />;

  const done = unit.lessons.filter((l) => l.status === 'done').length;
  const pct = Math.round((100 * done) / unit.lessons.length);

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <Link to={`/roadmaps/${r.id}`} className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> {r.title}
      </Link>
      <header className="relative overflow-hidden rounded-card bg-[#0d1b33] p-5 text-white md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Medallion name={unit.stop.university} size={68} state={unit.status === 'done' ? 'done' : 'open'} country={Math.max(0, countryIndex)} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#f6c343]">{unit.domain}</p>
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">{unit.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-white/75">
              <MapPin size={14} aria-hidden="true" /> {unit.stop.university}, {unit.stop.city}
              {country && (
                <span className="ml-1 inline-flex items-center gap-1.5">
                  <Flag code={country.code} size={16} /> {country.name}
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-6 text-white/85">{unit.summary}</p>
      </header>

      <section className="mt-3.5 rounded-card border border-line bg-surface p-[18px]">
        <div className="flex items-center justify-between">
          <p className="t-micro text-ink-2">Progress</p>
          <p className="t-headline text-ink">{pct}%</p>
        </div>
        <Progress value={pct} className="mt-2" />
        <p className="t-footnote mt-2 text-ink-2">
          {done} of {unit.lessons.length} lessons completed
        </p>
      </section>

      <ol className="relative mt-3.5 flex flex-col gap-3 pl-6 before:absolute before:bottom-6 before:left-[11px] before:top-6 before:w-0.5 before:bg-line">
        {unit.lessons.map((l, i) => (
          <LessonCard key={l.id} roadmapId={r.id} lesson={l} n={i + 1} />
        ))}
      </ol>
    </div>
  );
}

function LessonCard({ roadmapId, lesson: l, n }: { roadmapId: string; lesson: RoadmapLesson; n: number }) {
  const locked = l.status === 'locked';
  const icon = l.status === 'done' ? <Check size={13} strokeWidth={3} /> : locked ? <Lock size={11} /> : <PlayCircle size={13} />;
  const body = (
    <>
      <span className={`absolute -left-6 top-5 flex size-6 items-center justify-center rounded-full border-2 border-brand ${l.status === 'done' ? 'bg-good text-white' : locked ? 'bg-line-strong text-ink-2' : 'bg-primary text-on-primary'}`} aria-hidden="true">
        {icon}
      </span>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-micro text-ink-3">Lesson {n}</p>
          <p className={`t-headline mt-0.5 ${locked ? 'text-ink-2' : 'text-ink'}`}>{l.title}</p>
        </div>
        {l.status === 'done' ? <Pill tone="good">Done</Pill> : locked ? <Pill tone="neutral">{l.lock === 'enrolled_only' ? 'For SATMAKON students' : 'Locked'}</Pill> : <Pill tone="primary">In progress</Pill>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} aria-hidden="true" /> {l.minutes} min
        </span>
        <Dots label="Level check" done={l.level_check.passed ? 1 : 0} total={1} extra={l.level_check.best != null ? `best ${l.level_check.best}%` : undefined} />
        <Dots label="Homework" done={l.homework.done} total={l.homework.sets} />
        {!locked && (
          <span className="ml-auto inline-flex items-center gap-0.5 font-bold text-accent">
            See details <ChevronRight size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  );
  return (
    <li className="relative">
      {locked ? (
        <div className="relative rounded-card border border-line bg-surface p-4 opacity-70">{body}</div>
      ) : (
        <Link to={`/roadmaps/${roadmapId}/lessons/${l.id}`} className="relative block rounded-card border border-line bg-surface p-4 transition-colors hover:bg-surface-2">
          {body}
        </Link>
      )}
    </li>
  );
}

function Dots({ label, done, total, extra }: { label: string; done: number; total: number; extra?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${label}: ${done} of ${total} done${extra ? `, ${extra}` : ''}`}>
      <span className="font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`size-2.5 rounded-full ${i < done ? 'bg-good' : 'border border-line-strong'}`} aria-hidden="true" />
      ))}
      {extra && <span className="text-ink-3">{extra}</span>}
    </span>
  );
}
