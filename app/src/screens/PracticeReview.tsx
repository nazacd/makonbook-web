import { Check, ChevronLeft, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { RichContent } from '@/components/practice/RichContent';
import { Skeleton } from '@/components/States';
import { isCorrect, slotKey } from '@/lib/practice/grade';
import { useLocalAttempts, usePackage, useServerAttempts } from '@/lib/practice/hooks';
import { stagesOf, SUBJECT_LABEL } from '@/lib/practice/run';
import { useTitle } from '@/lib/title';

// One question of a finished attempt: the student's answer, the right one,
// and why. Laid out like the test: passage beside the question on a laptop.
export function PracticeReview() {
  const { id = '', slot = '' } = useParams();
  const navigate = useNavigate();
  const local = useLocalAttempts();
  const attempt = local.data?.find((a) => a.id === id);
  const server = useServerAttempts(!attempt && !local.isPending);
  const fromServer = server.data?.find((a) => a.id === id);
  const shown = attempt ?? fromServer;
  const code = shown ? ('code' in shown ? shown.code : shown.test) : '';
  const pkg = usePackage(code, shown?.version, !!shown);
  useTitle('Question');

  if (!shown || !pkg.data) {
    if ((local.isPending || server.isPending || pkg.isPending) && !pkg.isError) return <Skeleton height={120} />;
    return <Notice tone="error" message="This question isn’t here any more." />;
  }
  const { package: p, images: links } = pkg.data;
  const all = stagesOf(p, shown.sections).flatMap((stage) => stage.module.questions.map((q) => ({ stage, q, key: slotKey(stage.subject, stage.module.module, q.position) })));
  const at = all.findIndex((x) => x.key === slot);
  const item = all[at];
  if (!item) return <Notice tone="error" message="No such question in this attempt." />;
  const { stage, q } = item;
  const answers = attempt?.answers ?? fromServer?.answers ?? [];
  const given = answers.find((a) => slotKey(a.subject, a.module, a.position) === slot)?.answer ?? null;
  const right = isCorrect(q, given);
  const key = q.type === 'mcq' ? q.correct : (q.accepted ?? []).join(', ');
  const open = (i: number) => void navigate(`/practice/review/${id}/${all[i]!.key}`, { replace: true });

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => void navigate(`/practice/result/${id}`)} className="t-subhead -ml-1 inline-flex h-10 w-fit items-center gap-1 rounded-chip pr-2 text-accent">
        <Icon as={ChevronLeft} size={18} className="text-accent" />
        Result
      </button>
      <p className="t-footnote text-ink-3">
        {SUBJECT_LABEL[stage.subject]} · Module {stage.module.module} · Question {q.position} · {q.skill}
        {q.difficulty ? ` · ${q.difficulty[0]!.toUpperCase()}${q.difficulty.slice(1)}` : ''}
      </p>
      <p className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5">
        {right ? (
          <Verdict icon={Check} tone="text-good" text={`Correct · ${key}`} />
        ) : (
          <>
            {given ? <Verdict icon={X} tone="text-bad" text={`Your answer ${given}`} /> : <Verdict tone="text-ink-3" text="Blank" />}
            <Verdict icon={Check} tone="text-good" text={`Correct ${key}`} />
          </>
        )}
      </p>

      <div className={`grid gap-6 ${q.passage ? 'md:grid-cols-2' : ''}`}>
        {q.passage && (
          <div className="rounded-control bg-surface p-4">
            <RichContent text={q.passage} images={p.images} links={links} />
          </div>
        )}
        <div className="flex flex-col gap-4">
          <RichContent text={q.stem} images={p.images} links={links} className="rich rich-lg" />
          {q.choices &&
            (['A', 'B', 'C', 'D'] as const)
              .filter((l) => q.choices![l] != null)
              .map((l) => {
                const correct = l === q.correct;
                const chosen = l === given;
                return (
                  <div
                    key={l}
                    aria-label={`Choice ${l}${correct ? ', correct' : chosen ? ', your answer, wrong' : ''}`}
                    className={`flex min-h-[52px] items-center gap-3 rounded-control border p-3 ${correct ? 'border-good bg-good-tint' : chosen ? 'border-bad bg-bad-tint' : 'border-line bg-surface'}`}>
                    <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-full border t-subhead font-semibold ${correct ? 'border-good bg-good text-brand' : chosen ? 'border-bad bg-bad text-brand' : 'border-line-strong text-ink'}`}>
                      {l}
                    </span>
                    <span className="min-w-0 flex-1">
                      <RichContent text={q.choices![l]} images={p.images} links={links} displayMath />
                    </span>
                    {correct ? <Icon as={Check} size={20} strokeWidth={2.25} className="text-good" /> : chosen ? <Icon as={X} size={20} strokeWidth={2.25} className="text-bad" /> : null}
                  </div>
                );
              })}
          <section className="mt-2 flex flex-col gap-1">
            <h2 className="t-title3 text-[18px] leading-[23px] text-ink">Why</h2>
            <RichContent text={q.explanation} images={p.images} links={links} />
          </section>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <button type="button" onClick={() => open(at - 1)} disabled={at === 0} className="t-callout h-10 rounded-lg px-4 font-medium text-ink disabled:opacity-30">
          Back
        </button>
        <span className="t-subhead tabular font-medium text-ink">
          {at + 1} of {all.length}
        </span>
        <button type="button" onClick={() => (at < all.length - 1 ? open(at + 1) : void navigate(`/practice/result/${id}`))} className="t-callout h-10 rounded-lg bg-primary px-4 font-medium text-on-primary">
          {at < all.length - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </div>
  );
}

function Verdict({ icon, tone, text }: { icon?: typeof Check; tone: string; text: string }) {
  return (
    <span className={`t-callout flex items-center gap-1.5 font-medium ${tone}`}>
      {icon && <Icon as={icon} size={18} strokeWidth={2.25} className="text-current" />}
      {text}
    </span>
  );
}
