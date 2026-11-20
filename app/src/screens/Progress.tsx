import { Award, CalendarCheck, Flame, LayoutList, Medal, Network, Sparkles, Trophy } from 'lucide-react';
import { useState } from 'react';

import { useGamification, xp, type Gamification, type Quest } from '@/api/gamification';
import { Badge, ICON_OF } from '@/components/achievements/PixelIcon';
import { AchievementTree } from '@/components/achievements/Tree';
import { ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Progress as Bar, Widget, WidgetLabel } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { formatDate, relativeDay } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

// Your progress (spec 27): the level and its XP bar, the streak, today's and
// this week's quests, every achievement, and the last things that earned XP.
// All of it comes from the server; nothing is computed here.

const ACCENT = { level: 'var(--color-primary)', streak: 'var(--color-amber)', quests: 'var(--color-teal)', badges: 'var(--color-violet)', recent: 'var(--color-slate)' };

export function Progress() {
  useTitle('Your progress');
  const q = useGamification();
  const now = useNow();
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <PageHeader icon={Medal} title="Your progress" subtitle="XP for everything you do here; levels, a streak, quests and achievements." />
      {q.isPending ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="widget">
              <Skeleton width="40%" height={14} />
              <div className="mt-4">
                <Skeleton width="60%" height={36} />
              </div>
              <div className="mt-3">
                <Skeleton height={8} />
              </div>
            </div>
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <ErrorState title="Your progress didn’t load" message="Check the connection and try again." onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : (
        <Loaded g={q.data} now={now} />
      )}
    </div>
  );
}

function Loaded({ g, now }: { g: Gamification; now: number }) {
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const span = Math.max(1, g.next_level_xp - g.level_floor);
  const into = g.xp_total - g.level_floor;
  const unlocked = g.achievements.filter((a) => a.unlocked_at).length;
  return (
    <>
      <div className="grid gap-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Widget accent={ACCENT.level}>
          <WidgetLabel icon={Trophy} label="Level" accent={ACCENT.level} />
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <p className="text-ink">
              <span className="t-number text-[44px] leading-none">{g.level}</span> <span className="t-title3 ml-1 text-ink-2">{g.level_title}</span>
            </p>
            <p className="t-footnote text-ink-2">
              <b className="font-bold text-ink">{xp(g.xp_total)} XP</b> in all{g.xp_today > 0 ? `, ${xp(g.xp_today)} today` : ''}
            </p>
          </div>
          <Bar value={into / span} className="mt-3" />
          <p className="t-caption mt-1.5 flex justify-between text-ink-2">
            <span>{xp(g.level_floor)}</span>
            <span>
              {xp(g.next_level_xp - g.xp_total)} XP to level {g.level + 1}
            </span>
            <span>{xp(g.next_level_xp)}</span>
          </p>
          {g.leveled_up_today && <p className="t-footnote mt-2 font-bold text-accent">Level {g.level} unlocked today. Keep the momentum going.</p>}
        </Widget>
        <Widget accent={ACCENT.streak}>
          <WidgetLabel icon={Flame} label="Streak" accent={ACCENT.streak} />
          <p className="text-ink">
            <Flame size={18} className="-mt-1 mr-1 inline text-fill-watch" aria-hidden="true" />
            <span className="t-number text-[32px]">{g.streak.current}</span> <span className="t-subhead text-ink-2">{g.streak.current === 1 ? 'day' : 'days'} in a row</span>
          </p>
          <p className="t-footnote text-ink-2">
            Best {g.streak.best}.{' '}
            {g.streak.at_risk ? 'Nothing yet today: one short session keeps it alive.' : g.streak.active_today ? 'Today counts already.' : 'Any XP today starts one.'}
          </p>
          <div className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" role="img" aria-label="The last 14 days: which were active">
            {g.streak.days.map((d) => (
              <span key={d.day} className={`aspect-square rounded-[4px] ${d.active ? 'bg-fill-watch' : 'border border-line'}`} title={formatDate(d.day)} />
            ))}
          </div>
        </Widget>
      </div>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2">
        <QuestList title="Today’s quests" quests={g.quests.daily} note={`New ones ${resetsIn(g.quests.resets_at, now)}.`} />
        <QuestList title="This week’s quests" quests={g.quests.weekly} note="Monday to Sunday." />
      </div>

      <Widget accent={ACCENT.badges} className="mt-3.5">
        <WidgetLabel
          icon={Award}
          label="Achievements"
          accent={ACCENT.badges}
          right={
            <span className="flex items-center gap-2">
              <span className="t-caption text-ink-2">
                {unlocked} of {g.achievements.length}
              </span>
              <span className="flex rounded-full border border-line bg-surface-2 p-[2px]" role="radiogroup" aria-label="How to show the achievements">
                {(['tree', 'list'] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${view === v ? 'bg-accent-tint text-accent' : 'text-ink-2 hover:text-ink'}`}>
                    {v === 'tree' ? <Network size={13} aria-hidden="true" /> : <LayoutList size={13} aria-hidden="true" />}
                    {v === 'tree' ? 'Tree' : 'List'}
                  </button>
                ))}
              </span>
            </span>
          }
        />
        {view === 'tree' ? (
          <AchievementTree g={g} now={now} />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {g.achievements.map((a) => {
              const on = !!a.unlocked_at;
              const hidden = a.secret && !on;
              return (
                <li key={a.code} className={`mc-card ${on ? '' : 'is-locked'}`} data-kind={a.tier} title={a.description}>
                  <span className="mc-card-icon">
                    <Badge icon={hidden ? 'lock' : (ICON_OF[a.code] ?? 'star')} shape={a.tier} done={on} size={48} dim={!on} />
                  </span>
                  <span className="mc-card-text flex-1">
                    <span className="mc-card-head">{on ? (a.tier === 'challenge' ? 'Challenge complete!' : 'Achievement unlocked!') : a.tier === 'challenge' ? 'Challenge' : a.tier === 'goal' ? 'Goal' : 'Achievement'}</span>
                    <span className="mc-card-title">{a.title}</span>
                    <span className="mc-card-sub">
                      {a.description} {on ? `Unlocked ${relativeDay(Date.parse(a.unlocked_at!), now)}.` : hidden ? '' : `${xp(a.progress)} / ${xp(a.target)}`}
                    </span>
                    {!on && !hidden && (
                      <span className="mc-card-bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (100 * a.progress) / Math.max(1, a.target))}%` }} />
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Widget>

      <Widget accent={ACCENT.recent} className="mt-3.5">
        <WidgetLabel icon={Sparkles} label="Recent XP" accent={ACCENT.recent} />
        {g.recent.length === 0 ? (
          <p className="t-subhead text-ink-2">Nothing yet. A mock test, a homework set, a round of words: it all counts.</p>
        ) : (
          <ul className="divide-y divide-line">
            {g.recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="t-subhead block truncate text-ink">{e.title}</span>
                  <span className="t-caption block font-medium text-ink-2">{relativeDay(Date.parse(e.happened_at), now)}</span>
                </span>
                <span className="t-number shrink-0 text-[16px] text-accent">+{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </Widget>
    </>
  );
}

function QuestList({ title, quests, note }: { title: string; quests: Quest[]; note: string }) {
  const done = quests.filter((q) => q.done_at).length;
  return (
    <Widget accent={ACCENT.quests}>
      <WidgetLabel icon={CalendarCheck} label={title} accent={ACCENT.quests} right={<span className="t-caption text-ink-2">{done} of {quests.length} done</span>} />
      <ul className="flex flex-col gap-3">
        {quests.map((q) => {
          const on = !!q.done_at;
          return (
            <li key={q.code}>
              <div className="flex items-center justify-between gap-3">
                <span className={`t-subhead ${on ? 'text-ink-2 line-through' : 'text-ink'}`}>{q.title}</span>
                <span className={`t-caption shrink-0 rounded-full px-2 py-0.5 ${on ? 'bg-good-tint text-good' : 'bg-accent-tint text-accent'}`}>{on ? 'done' : `+${q.reward_xp} XP`}</span>
              </div>
              <Bar value={q.progress / q.target} tone={on ? 'good' : 'primary'} className="mt-1.5" />
              <p className="t-caption mt-1 font-medium text-ink-2">
                {q.progress} / {q.target}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="t-caption mt-3 font-medium text-ink-3">{note}</p>
    </Widget>
  );
}

/** "in 5 h", "in 40 min", from the server's reset time. */
function resetsIn(at: string, now: number): string {
  const ms = Date.parse(at) - now;
  if (ms <= 60_000) return 'any moment now';
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `in ${h} h` : `in ${Math.round(ms / 60_000)} min`;
}
