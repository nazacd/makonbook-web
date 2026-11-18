import { ArrowLeft, ArrowRight, CalendarClock, Clock, Gift, Hourglass, ListChecks, Lock, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { clock, useCompetition, useCompetitionBoard, useStartCompetition, type BoardEntry, type Competition } from '@/api/competitions';
import { describeError } from '@/api/errors';
import { assessmentKey } from '@/api/roadmaps';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/api/queries';
import { dueLong } from '@/components/assignments/format';
import { Avatar } from '@/components/Avatar';
import { Notice } from '@/components/Notice';
import { ErrorState, Skeleton } from '@/components/States';
import { Action, Modal, Pill } from '@/components/ui';
import { useFastNow, useNow } from '@/lib/clock';
import { useTitle } from '@/lib/title';

import { StartsIn, statusAt, SUBJECT_LABEL, SUBJECT_TONE } from './Competitions';

// "/competitions/:id": a competition's details and rules, the student's
// one attempt (start, continue, or the result), and the board, refreshed
// while it is live.

export function CompetitionPage() {
  const { id = '' } = useParams();
  const q = useCompetition(id);
  useTitle(q.data?.competition.title ?? 'Competition');
  const now = useNow() + (q.data?.skew ?? 0);

  if (q.isPending)
    return (
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
        <Skeleton height={220} radius={16} />
        <Skeleton height={300} radius={16} />
      </div>
    );
  if (q.isError)
    return (
      <div className="mx-auto w-full max-w-[1000px]">
        <ErrorState title="Couldn’t load this competition" message={describeError(q.error)} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </div>
    );
  const { competition: c, skew } = q.data;
  const status = statusAt(c, now);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <Link to="/competitions" className="t-subhead mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Competitions
      </Link>
      {/* Phones: the competition, its board, then the rules. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr]">
        <section className="min-w-0 rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={SUBJECT_TONE[c.subject]}>{SUBJECT_LABEL[c.subject]}</Pill>
            {status === 'live' ? (
              <Pill tone="bad" solid>
                <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> Live
              </Pill>
            ) : status === 'upcoming' ? (
              <Pill tone="info">Coming up</Pill>
            ) : (
              <Pill>Ended</Pill>
            )}
          </div>
          <h1 className="mt-3 text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-title">{c.title}</h1>
          {c.description && <p className="t-body mt-2 whitespace-pre-line text-ink-2">{c.description}</p>}
          {c.prize && (
            <div className="mt-4 flex items-start gap-3 rounded-control border border-accent/25 bg-accent-tint p-3.5">
              <Gift size={19} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="t-micro text-accent">Prize</p>
                <p className="t-subhead mt-0.5 font-semibold text-ink">{c.prize}</p>
              </div>
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fact icon={CalendarClock} label="Opens" value={dueLong(c.starts_at)} />
            <Fact icon={Hourglass} label="Closes" value={dueLong(c.ends_at)} />
            <Fact icon={ListChecks} label="Questions" value={String(c.questions)} />
            <Fact icon={Clock} label="Time limit" value={`${c.minutes} min`} />
          </dl>
          <Attempt c={c} status={status} skew={skew} />
        </section>

        <Board c={c} status={status} />
        <Rules c={c} />
      </div>
    </div>
  );
}

function Fact({ icon: I, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div>
      <dt className="t-footnote flex items-center gap-1 text-ink-3">
        <I size={13} aria-hidden="true" /> {label}
      </dt>
      <dd className="t-subhead mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** What the student can do now: start, continue, see their result, or wait. */
function Attempt({ c, status, skew }: { c: Competition; status: Competition['status']; skew: number }) {
  const navigate = useNavigate();
  const me = useMe().data;
  const start = useStartCompetition();
  const [confirm, setConfirm] = useState(false);
  const now = useNow() + skew;
  const student = me?.kind === 'student';
  const mine = c.mine;
  const queryClient = useQueryClient();
  // The attempt is read fresh: the server may have graded it since (its time ran out), and a cached open copy would run a clock at zero.
  const openAttempt = (id: string) => {
    queryClient.removeQueries({ queryKey: assessmentKey(id) });
    void navigate(`/assessments/${id}`);
  };
  const go = () =>
    start.mutate(c.id, {
      onSuccess: (a) => void navigate(`/assessments/${a.id}`),
      onError: (e) => e instanceof ApiError && e.code === 'already_attempted' && setConfirm(false),
    });

  let body;
  if (mine?.finished) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-subhead text-ink-2">
          You handed in <span className="font-bold text-ink">{mine.correct}</span> of {mine.total} right{status === 'ended' ? '.' : '. Answers open when it closes.'}
        </p>
        <Action icon={ArrowRight} onClick={() => openAttempt(mine.assessment_id)}>
          Your result
        </Action>
      </div>
    );
  } else if (mine && status === 'live') {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-subhead text-ink-2">
          Your attempt is open: <TimeLeft deadline={Date.parse(mine.deadline)} skew={skew} /> left.
        </p>
        <Action icon={ArrowRight} onClick={() => openAttempt(mine.assessment_id)}>
          Continue
        </Action>
      </div>
    );
  } else if (status === 'upcoming') {
    body = (
      <p className="t-subhead text-ink-2">
        <StartsIn at={Date.parse(c.starts_at)} skew={skew} />
      </p>
    );
  } else if (status === 'live' && student) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-subhead text-ink-2">Open now. Start when you have {c.minutes} minutes to spare.</p>
        <Action icon={ArrowRight} onClick={() => setConfirm(true)}>
          Take part
        </Action>
      </div>
    );
  } else if (status === 'live') {
    body = <p className="t-subhead text-ink-2">Open now for students. The board on this page updates as they hand in.</p>;
  } else {
    body = <p className="t-subhead text-ink-2">This competition has closed{student ? ' and you didn’t take part' : ''}.</p>;
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      {body}
      {start.isError && !confirm && (
        <div className="mt-3">
          <Notice tone="error" message={describeError(start.error)} />
        </div>
      )}
      {confirm && (
        <Modal
          title="Start now?"
          subtitle={c.title}
          onClose={() => setConfirm(false)}
          width={460}
          footer={
            <div className="flex justify-end gap-2.5">
              <Action variant="outline" onClick={() => setConfirm(false)}>
                Not yet
              </Action>
              <Action icon={ArrowRight} onClick={go} disabled={start.isPending}>
                {start.isPending ? 'Starting…' : 'Start the clock'}
              </Action>
            </div>
          }>
          <p className="t-subhead text-ink-2">
            You have <span className="font-bold text-ink">{c.minutes} minutes</span> from now{Date.parse(c.ends_at) - now < c.minutes * 60_000 ? ', or less: it closes at ' + dueLong(c.ends_at) : ''}. The clock keeps running if you leave the
            page, and this is your only try.
          </p>
          {start.isError && (
            <div className="mt-3">
              <Notice tone="error" message={describeError(start.error)} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function TimeLeft({ deadline, skew }: { deadline: number; skew: number }) {
  const now = useFastNow() + skew;
  return <span className="tabular font-bold text-ink">{clock(deadline - now)}</span>;
}

function Rules({ c }: { c: Competition }) {
  const rules = [
    'One try each. Once you start, there is no second attempt.',
    `The clock runs for ${c.minutes} minutes from when you start, or until the competition closes, whichever comes first. It keeps running if you leave the page.`,
    'Your answers are saved as you go. When the time is up, what was saved counts.',
    'Answers and explanations open for everyone when the competition closes.',
    'The board ranks right answers first; if two are level, the faster one is higher.',
  ];
  return (
    <section className="min-w-0 rounded-card border border-line bg-surface p-5 sm:p-6 lg:col-start-1">
      <h2 className="t-headline flex items-center gap-2 text-ink">
        <ShieldCheck size={18} className="text-accent" aria-hidden="true" /> Rules
      </h2>
      <ol className="mt-3 flex flex-col gap-2.5">
        {rules.map((r, i) => (
          <li key={i} className="t-subhead flex gap-3 text-ink-2">
            <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-ink">{i + 1}</span>
            {r}
          </li>
        ))}
      </ol>
    </section>
  );
}

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Board({ c, status }: { c: Competition; status: Competition['status'] }) {
  const live = status === 'live';
  const board = useCompetitionBoard(c.id, live);
  const b = board.data;
  const meShown = b?.entries.some((e) => e.me);
  return (
    <section className="h-fit rounded-card border border-line bg-surface p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="t-headline flex items-center gap-2 text-ink">
          <Trophy size={18} className="text-accent" aria-hidden="true" /> Board
        </h2>
        {b && (
          <span className="t-footnote inline-flex items-center gap-1 text-ink-3">
            <Users size={13} aria-hidden="true" /> {b.participants}
          </span>
        )}
      </div>
      {live && <p className="t-caption mt-1 text-ink-3">Updates every 15 seconds as students hand in.</p>}
      {status === 'upcoming' ? (
        <p className="t-subhead mt-4 flex items-center gap-2 text-ink-2">
          <Lock size={15} aria-hidden="true" /> The board fills once it opens.
        </p>
      ) : board.isPending ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : board.isError ? (
        <div className="mt-4">
          <Notice tone="error" message={describeError(board.error)} />
        </div>
      ) : b!.entries.length === 0 ? (
        <p className="t-subhead mt-4 text-ink-2">{live ? 'Nobody has handed in yet. Be the first.' : 'Nobody took part.'}</p>
      ) : (
        <>
          <ol className="mt-3 flex flex-col" aria-label="Ranking">
            {b!.entries.map((e, i) => (
              <Row key={i} e={e} />
            ))}
          </ol>
          {b!.me && !meShown && (
            <>
              <p className="t-caption py-1 text-center text-ink-3" aria-hidden="true">
                ⋯
              </p>
              <ol aria-label="Your place">
                <Row e={b!.me} />
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}

// The vocabulary leaderboard's medals.
const MEDAL = ['bg-[#e8b923] text-[#3d2c00]', 'bg-[#c4ccd6] text-[#253041]', 'bg-[#d08a52] text-[#3b1d06]'];

function Row({ e }: { e: BoardEntry }) {
  const [first, last = ''] = e.name.split(' ');
  return (
    <li className={`flex items-center gap-2.5 rounded-control px-2 py-2 ${e.me ? 'bg-accent-tint' : ''}`}>
      <span className="flex w-7 shrink-0 justify-center">
        <span className={`tabular flex size-6 items-center justify-center rounded-full text-[12px] font-extrabold ${e.rank <= 3 ? MEDAL[e.rank - 1] : 'text-ink-2'}`}>{e.rank}</span>
      </span>
      <Avatar kind="student" firstName={first ?? ''} lastName={last} id={e.rank} size={30} photo={e.photo_url} />
      <span className={`t-subhead min-w-0 flex-1 truncate ${e.me ? 'font-bold text-accent' : 'text-ink'}`}>
        {e.name}
        {e.me && ' (you)'}
      </span>
      <span className="text-right">
        <span className="tabular t-subhead block font-bold text-ink">
          {e.correct}/{e.total}
        </span>
        <span className="tabular t-caption block text-ink-3">{minutes(e.seconds)}</span>
      </span>
    </li>
  );
}
