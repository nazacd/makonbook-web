import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { describeError } from '@/api/errors';
import { useGoals, useSaveGoals } from '@/api/learning';
import { useMe } from '@/api/queries';
import { useUniversities, type University } from '@/api/universities';
import { BRAND, ShieldMark } from '@/components/brand/Logo';
import { Globe } from '@/components/globe/lazy';
import { DreamStep } from '@/components/onboarding/DreamStep';
import { useTitle } from '@/lib/title';

// "/dream": choosing or changing the dream university after onboarding (and
// for enrolled students, who never see onboarding): the onboarding's globe
// step on its own. Saving keeps the other goals as they are.

export function DreamUniversity() {
  useTitle('Your dream university');
  const me = useMe().data;
  const goals = useGoals(me?.kind === 'student');
  if (me && me.kind !== 'student') return <Navigate to="/" replace />;
  if (goals.isPending) return <div className="onb h-dvh" />;
  return <Chooser initial={goals.data?.university ?? null} goals={goals.data} />;
}

function Chooser({ initial, goals }: { initial: University | null; goals: ReturnType<typeof useGoals>['data'] }) {
  const navigate = useNavigate();
  const universities = useUniversities();
  const save = useSaveGoals();
  const [dream, setDream] = useState<University | null>(initial);
  const [browsing, setBrowsing] = useState(!initial);
  const [look, setLook] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const list = universities.data;
  const points = useMemo(() => (list ?? []).filter((u) => u.location).map((u) => ({ id: u.id, lat: u.location!.lat, lng: u.location!.lng })), [list]);

  const choose = (u: University) => {
    setDream(u);
    setBrowsing(false);
    setMatches([]);
  };
  const leave = () => void navigate(-1);
  const keep = () =>
    dream &&
    save.mutate(
      { target_math: goals?.target_math ?? null, target_rw: goals?.target_rw ?? null, exam_date: goals?.exam_date ?? null, university_id: dream.id },
      { onSuccess: () => void navigate('/', { replace: true }) },
    );

  return (
    <div className="onb relative flex h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <Globe points={points} selected={dream?.id ?? null} matches={matches} look={look} arcTo={null} mode="hero" zoomable onPick={(id) => { const u = list?.find((x) => x.id === id); if (u) choose(u); }} />
        </Suspense>
      </div>
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <span className="flex items-center gap-2.5 text-[var(--onb-ink)]">
          <ShieldMark size={30} />
          <span className="text-[19px] font-extrabold tracking-[-0.03em]">{BRAND}</span>
        </span>
      </header>
      <main className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col px-4 md:px-8">
        <DreamStep list={list} loading={universities.isPending} failed={universities.isError} dream={dream} browsing={browsing} onBrowse={() => setBrowsing(true)} onChoose={choose} onLook={setLook} onMatches={setMatches} />
      </main>
      <footer className="relative z-10 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
        {save.isError && <p className="rounded-[12px] bg-[rgba(255,90,90,0.15)] px-3 py-2 text-center text-[14px] text-[#ffb4b4]">{describeError(save.error)}</p>}
        <div className="flex items-center justify-between">
          <button type="button" onClick={leave} className="flex h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-[var(--onb-ink-2)] hover:bg-white/10 hover:text-[var(--onb-ink)]">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <button type="button" onClick={keep} disabled={!dream || browsing || save.isPending || dream.id === initial?.id} className="cta flex h-12 items-center gap-2 rounded-full px-6 text-[15.5px] font-bold">
            {save.isPending ? 'Saving…' : 'Make this my dream'} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
