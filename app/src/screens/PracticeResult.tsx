import { ChevronLeft, CircleAlert, CloudCheck, CloudUpload, FileQuestion, type LucideIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { QuestionNavigatorGrid } from '@/components/practice/QuestionNavigatorGrid';
import { EmptyState, Skeleton } from '@/components/States';
import { ScreenTitle } from '@/layouts/AppShell';
import { isCorrect, slotKey } from '@/lib/practice/grade';
import { useLocalAttempts, usePackage, useServerAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import { stagesOf, SUBJECT_LABEL, testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

// An attempt's result: the estimated score, then each module's questions
// right, wrong or blank, each opening its review. A full test splits into its
// two sections; one section on its own is the score itself.
export function PracticeResult() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const local = useLocalAttempts();
  useUploadAttempts(true);
  const attempt = local.data?.find((a) => a.id === id);
  const server = useServerAttempts(!attempt && !local.isPending);
  const fromServer = server.data?.find((a) => a.id === id);
  const shown = attempt ?? fromServer;
  const answersList = attempt?.answers ?? fromServer?.answers ?? [];
  const code = shown ? ('code' in shown ? shown.code : shown.test) : '';
  const pkg = usePackage(code, shown?.version, !!shown);
  useTitle(shown ? testName(shown.title) : 'Result');

  if (local.isPending || (!attempt && server.isPending)) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Skeleton width={180} height={64} />
        <Skeleton width="70%" height={20} />
        <Skeleton height={44} />
      </div>
    );
  }
  if (!shown) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <EmptyState icon={FileQuestion} title="No such result" message="This result isn’t here. It may be on your phone." />
      </div>
    );
  }

  const sections = shown.sections as Subject[];
  const full = shown.total != null;
  const only = sections[0]!;
  const answers = new Map(answersList.map((a) => [slotKey(a.subject, a.module, a.position), a.answer]));
  const sent: { icon: LucideIcon; tone: string; text: string } | null = !attempt
    ? null
    : attempt.rejected
      ? { icon: CircleAlert, tone: 'text-bad', text: `Not sent to your teachers: ${attempt.rejected}` }
      : attempt.uploaded
        ? { icon: CloudCheck, tone: 'text-good', text: 'Sent to your teachers' }
        : { icon: CloudUpload, tone: 'text-ink-3', text: 'Sends to your teachers when you’re online' };
  const score = full ? shown.total : shown.scores[only]?.score;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <div>
        <Link to={`/practice/test/${encodeURIComponent(code)}`} className="t-subhead -ml-1 mb-4 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
          <Icon as={ChevronLeft} size={18} className="text-accent" />
          {testName(shown.title)}
        </Link>
        <ScreenTitle title="Result" />
        <p className="flex items-baseline gap-2.5" aria-label={`Estimated ${full ? 'SAT' : SUBJECT_LABEL[only]} score ${score ?? 'unknown'} of ${full ? 1600 : 800}`}>
          <span className="font-title tabular text-[64px] font-bold leading-[70px] text-ink">{score ?? '–'}</span>
          <span className="t-callout text-ink-3">of {full ? 1600 : 800}</span>
        </p>
        {full ? (
          <div className="mt-3 flex">
            {sections.map((s, i) => {
              const sc = shown.scores[s];
              return (
                <div key={s} className={`flex flex-1 flex-col gap-1.5 ${i ? 'border-l border-line pl-[18px]' : ''}`}>
                  <span className="t-subhead text-ink-2">{SUBJECT_LABEL[s]}</span>
                  <span className="font-title tabular text-[30px] font-bold leading-[34px] text-ink">{sc?.score ?? '–'}</span>
                  {sc && (
                    <span className="t-footnote tabular text-ink-3">
                      {sc.raw} of {sc.questions} right
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 flex items-baseline gap-2">
            <span className="t-title3 text-ink">{SUBJECT_LABEL[only]}</span>
            {shown.scores[only] && (
              <span className="t-subhead tabular text-ink-3">
                {shown.scores[only]!.raw} of {shown.scores[only]!.questions} right
              </span>
            )}
          </p>
        )}
      </div>

      {sent && (
        <p className="t-subhead flex items-center gap-2 text-ink-2">
          <Icon as={sent.icon} size={17} className={sent.tone} />
          {sent.text}
        </p>
      )}

      {pkg.data ? (
        stagesOf(pkg.data.package, sections).map((stage) => {
          const items = stage.module.questions.map((q) => {
            const given = answers.get(slotKey(stage.subject, stage.module.module, q.position));
            return { id: q.position, outcome: !given ? ('skipped' as const) : isCorrect(q, given) ? ('correct' as const) : ('incorrect' as const) };
          });
          const right = items.filter((x) => x.outcome === 'correct').length;
          const wrong = items.filter((x) => x.outcome === 'incorrect').length;
          const blank = items.length - right - wrong;
          return (
            <section key={`${stage.subject}-${stage.module.module}`} className="flex flex-col gap-3">
              <div>
                <h2 className="t-title3 text-[18px] leading-[23px] text-ink">
                  {SUBJECT_LABEL[stage.subject]} · Module {stage.module.module}
                </h2>
                <p className="t-subhead tabular">
                  <span className="font-medium text-good">{right} right</span>
                  {wrong > 0 && (
                    <>
                      <span className="text-ink-3"> · </span>
                      <span className="font-medium text-bad">{wrong} wrong</span>
                    </>
                  )}
                  {blank > 0 && <span className="text-ink-3"> · {blank} blank</span>}
                </p>
              </div>
              <QuestionNavigatorGrid variant="results" items={items} onPress={(position) => void navigate(`/practice/review/${id}/${slotKey(stage.subject, stage.module.module, position)}`)} />
            </section>
          );
        })
      ) : pkg.isPending ? (
        <Skeleton height={44} />
      ) : (
        <p className="t-subhead text-ink-2">The questions couldn’t be loaded right now.</p>
      )}

      <p className="t-caption font-normal text-ink-3">Scores are an estimate from College Board’s practice tests; the real SAT adapts to you.</p>
    </div>
  );
}
